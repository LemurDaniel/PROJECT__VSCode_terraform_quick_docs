

const {
    Position,
    Range
} = require('vscode-languageserver/node')

const {
    findRequiredProvider
} = require('./analyze_required_providers')

const Settings = require('../settings')
const Registry = require('../registry')


async function handleProviderResource(document, identifier, category) {

    console.log(`---------------------------------`)
    console.log(`Search Identifier: ${identifier}`)
    console.log(`Search Category: ${category}`)

    const fsPath = await Settings.clientConnection.sendRequest('fspath.get', document.uri)
    const requiredProvider = await findRequiredProvider(fsPath, identifier)
    console.log('Required Provider: ', JSON.stringify(requiredProvider))

    let resourceInfo = null
    if (requiredProvider && requiredProvider.source) {
        console.log('Searching via required_providers: ')
        console.log(`Found ${requiredProvider.version} | Ignoring Version: ${Settings.ignoreVersion}`)

        resourceInfo = await Registry.instance.getProviderInfo(requiredProvider.source, requiredProvider.version)
            .then(providerInfo =>
                Registry.instance.getProviderResource(providerInfo, identifier, category)
            )
            .catch(error => console.log(error))

        console.log(JSON.stringify(resourceInfo))
        console.log(`---------------------------------`)
    }
    else {
        console.log('Searching in official/partner Providers: ')

        resourceInfo = await Registry.instance.findProviderResource(identifier, category)
            .then(result => result.resourceInfo).catch(error => console.log(error))
    }

    if (resourceInfo == null) {
        console.log('Not Found!')
        console.log(`---------------------------------`)
        return null
    }

    console.log(JSON.stringify(resourceInfo))
    console.log(`---------------------------------`)

    let content = null
    if (resourceInfo.isBuiltin)
        content = `[**${identifier}**](${resourceInfo.docsUrl})`
    else if (resourceInfo != null)
        content = `[**Terraform Registry**](${resourceInfo.docsUrl})`

    return {
        contents: content
    }

}

// TODO use blockAnalyzer instead of going throug line by line
async function handleProviderModule(document, position) {

    console.log(`---------------------------------`)
    let source = null
    let version = null
    let lineNum = position.line + 1

    let level = 1
    do {
        const start = Position.create(lineNum, 0)
        const end = Position.create(lineNum + 1, 0)
        const range = Range.create(start, end)
        const line = document.getText(range)

        for (const char of line.split('')) {
            if (char == '{') level++
            else if (char == '}') level--
            else if (level < 0) return null
            else continue
        }

        if (line.match(/\s*version\s*=\s*"[\d\.]+"/)) {
            version = line.match(/=\s*"[\d\.]+"/)[0].replace(/[="]+/g, '').trim()
        }
        else if (line.match(/\s*source\s*=\s*"[^"]+"/)) {
            source = line.match(/=\s*"[^"]+"/)[0].replace(/[="]+/g, '').trim()
        }
        else if (line.match(/module|resource|data|locals|output|terraform|provider/)) {
            break
        }

        lineNum++

    } while (level != 0 && lineNum < document.lineCount && (null == source || null == version))

    if (lineNum == document.lineCount) {
        console.log('EOF')
    }

    console.log(`Search Module`)
    console.log(`Search Source: '${source}'`)
    console.log(`Search Version: '${version}'`)

    if (null == source) return null

    // Generic Git Repository
    if (Settings.supportOtherModuleSource && (source.match(/^git::ssh/i) || source.match(/^git::http/i))) {

        const url = source
            // remove prefix when over https
            .replace(/git::https:\/\//i, '')
            // remove prefix when over ssh
            .replace(/git::ssh:\/\/[^@]+@/i, '')
            .replace(/^[^@]+@/, '')
            .replace('.git', '')
            .replace(/\?.+/, '')
            .replace(/\/\/.*/, '')

        const protocol = source.includes('http://') ? 'http' : 'https'

        return {
            contents: `[**${url}**](${protocol}://${url})`
        }
    }

    // unprefixed github.com URLs or unprefixed bitbucket.org URLs
    if (Settings.supportOtherModuleSource && source.match(/github\.com[:\/]?/i) || source.match(/bitbucket\.org\//i)) {

        const url = source
            .replace(/git@github.com:/i, 'github.com/').replace(/\.git/, '')
            .split('/').slice(0, 3).join('/')

        const protocol = source.includes('http://') ? 'http' : 'https'

        return {
            contents: `[**${url}**](${protocol}://${url})`
        }
    }

    // Modules in the terraform registry
    const moduleInfo = await Registry.instance.getModuleInfo(source, version)
    if (null == moduleInfo) return null

    console.log(`Found Module: '${moduleInfo.id}'`)
    console.log(`---------------------------------`)

    return {
        contents: `[**Terraform Registry**](${moduleInfo.docsUrl})`
    }

}


async function getLinkForPosition(document, position) {

    // Get Textline
    const lineStart = Position.create(position.line, 0)
    const lineEnd = Position.create(position.line + 1, 0)
    const lineRange = Range.create(lineStart, lineEnd)

    const fullLine = document.getText(lineRange).replace(/([\r\n]+|[\n]+)/, '')

    const isResourceDefinition = fullLine.match(/resource\s*"[A-Za-z0-9_]+"/)
    const isDatasourceDefinition = fullLine.match(/data\s*"[A-Za-z0-9_]+"/)
    const isModuleDefinition = fullLine.match(/\s*module\s*"[A-Za-z0-9_-]+"/)


    if (isResourceDefinition) {
        const identifier = isResourceDefinition.at(0).match(/"[A-Za-z0-9_]+"/)[0].replace(/"+/g, '')
        return await handleProviderResource(document, identifier, Registry.TYPES['resource'])
    } else if (isDatasourceDefinition) {
        const identifier = isDatasourceDefinition.at(0).match(/"[A-Za-z0-9_]+"/)[0].replace(/"+/g, '')
        return await handleProviderResource(document, identifier, Registry.TYPES['data'])
    } else if (isModuleDefinition) {
        return await handleProviderModule(document, position)
    }

    // Inline datasource matches
    for (const inlineDataSource of fullLine.matchAll(/data\.[a-z0-9_]+/gi)) {
        const inRange = position.character >= inlineDataSource.index &&
            position.character <= (inlineDataSource.index + inlineDataSource.at(0).length)

        if (!inRange) continue

        const identifier = inlineDataSource.at(0).split('.').at(1)
        return await handleProviderResource(document, identifier, Registry.TYPES['data'])
    }

    // Inline provider resources matches
    for (const inlineResource of fullLine.matchAll(/(?<!data\.[a-z0-9_]*)[a-z0-9_]+_[a-z0-9_]+/gi)) {
        const inRange = position.character >= inlineResource.index &&
            position.character <= (inlineResource.index + inlineResource.at(0).length)

        if (!inRange) continue

        const identifier = inlineResource.at(0)
        return await handleProviderResource(document, identifier, Registry.TYPES['resource'])
    }

    // Inline function elements
    for (const functionInfo of Registry.instance.getFunctionsFlat()) {
        for (const inlineResource of fullLine.matchAll(new RegExp(`[^a-z]${functionInfo.title}[\s]*[\(]+`, 'gi'))) {
            const inRange = position.character >= inlineResource.index &&
                position.character <= (inlineResource.index + inlineResource.at(0).length)
            if (!inRange) continue

            const webUrl = `${Registry.instance.getFunctionsData().baseUrl}/${functionInfo.path}`//.replace(/[^:][/]+/g, '/')
            return {
                contents: `[**${functionInfo.syntax[0]}** Documentation](${webUrl})`
                // contents: `[**${functionInfo.syntax[0]}**](${webUrl}) ${functionInfo.description.replace(/`[^`]+`/g, '')}`
            }
        }
    }
}

module.exports = {
    getLinkForPosition
}