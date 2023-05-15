

const {
    Position,
    Range
} = require('vscode-languageserver/node')

const Registry = require('../utility/registry');





async function handleProviderResource(identifier, category) {

    console.log(`---------------------------------`)
    console.log(`Search Identifier: ${identifier}`)
    console.log(`Search Category: ${category}`)

    const { resourceInfo, providerInfo } = await Registry.instance.findProviderResource(identifier, category)

    console.log(JSON.stringify(resourceInfo))
    console.log(`---------------------------------`)

    let content = `[**Terraform Registry**](${resourceInfo.docsUrl})`

    return {
        contents: content
    }

}

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
        return await handleProviderResource(identifier, Registry.TYPES['resource'])
    } else if (isDatasourceDefinition) {
        const identifier = isDatasourceDefinition.at(0).match(/"[A-Za-z0-9_]+"/)[0].replace(/"+/g, '')
        return await handleProviderResource(identifier, Registry.TYPES['data'])
    } else if (isModuleDefinition) {
        return await handleProviderModule(document, position)
    }

    // Inline datasource matches
    for (const inlineDataSource of fullLine.matchAll(/data\.[A-Za-z0-9_]+/g)) {
        const inRange = position.character >= inlineDataSource.index &&
            position.character <= (inlineDataSource.index + inlineDataSource.at(0).length)

        if (!inRange) continue

        const identifier = inlineDataSource.at(0).split('.').at(1)
        return await handleProviderResource(identifier, Registry.TYPES['data'])
    }

    // Inline provider resources matches
    for (const inlineResource of fullLine.matchAll(/(?<!data\.[A-Za-z0-9_]*)[A-Za-z0-9_]+_[A-Za-z0-9_]+/g)) {
        const inRange = position.character >= inlineResource.index &&
            position.character <= (inlineResource.index + inlineResource.at(0).length)

        if (!inRange) continue

        const identifier = inlineResource.at(0)
        return await handleProviderResource(identifier, Registry.TYPES['resource'])
    }

}

module.exports = {
    getLinkForPosition
}