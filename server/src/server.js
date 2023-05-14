

const {
    DidChangeConfigurationNotification,
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    Position,
    Range,
} = require('vscode-languageserver/node')

const {
    TextDocument
} = require('vscode-languageserver-textdocument')

const Registry = require('./registry');
const BlockAnalyzer = require('./blockAnalyzer')
const DocsAnalyzer = require('./docsAnalyzer')


// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

///////////////////////////////////////////////////////////////////////////////////////////////////////
////// File opens, changes
//////////////////////////////////////////////////////////////////////////////////////////////////////


const docsAnalyzer = new DocsAnalyzer()
const blockAnalyzer = new BlockAnalyzer()
const tfConfigParseCache = {}
const tfDocsAnalyzeCache = {}

function analyzeFile(document) {

    if (document._uri in tfConfigParseCache) {
        const { content, changed, lastParse } = tfConfigParseCache[document._uri]
        if (!changed) return content
    }

    tfConfigParseCache[document._uri] = {
        lastParse: Date.now(),
        content: blockAnalyzer.analyze(document.getText()),
        changed: false
    }

    // Call and already cache elements
    //tfConfigParseCache[document._uri].content.forEach(
    //    definitionBlock => completionMetaForBlock(definitionBlock)
    //)

    return tfConfigParseCache[document._uri].content
}


// The content of a text document has changed. This event is emitted
documents.onDidChangeContent(({ document }) => {

    if (document._uri in tfConfigParseCache) {
        tfConfigParseCache[document._uri].changed = true
    }

})

// Call necesseray apis on document.open
documents.onDidOpen(({ document }) => {

    let matches = document._content.match(/resource\s*"[A-Za-z0-9_]+"|data\s*"[A-Za-z0-9_]+"/g)
    if (null == matches) return

    matches = matches.map(line => line.match(/"[A-Za-z0-9_]+"/)[0].replace(/"+/g, ''))
        .map(line => line.split('_').at(0))
        .reduce((acc, value) => ({
            ...acc,
            [value]: value
        }), {})
    if (null == matches) return

    Object.keys(matches).forEach(resourceIdentifier =>
        Registry.instance.findProviderInfo(resourceIdentifier, connection)
            .catch(error => connection.console.log(error.message))
    )

    analyzeFile(document)
})

///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Autcompletion
//////////////////////////////////////////////////////////////////////////////////////////////////////

function inRange(position, range) {
    return position.line > range.linestart && position.line < range.lineend
}

function findBlock(definitions, position) {

    const line = position.line
    for (const definitionBlock of definitions) {

        if (!inRange(position, definitionBlock.value.range)) continue

        if (definitionBlock.value.dynamics.length > 0) {
            const block = findBlock(definitionBlock.dynamics, position)
        }

        if (definitionBlock.type != 'DynamicDefinition') return definitionBlock
        if (null == definitionBlock.type.attributes.for_each) return definitionBlock

        if (!inRange(position, definitionBlock.value.attributes.content.range)) return definitionBlock

        return definitionBlock.value.attributes.content

    }

    return null
}

async function completionMetaForBlock(blockDefinition) {

    if (null == blockDefinition) return

    let resourceInfo = null
    const identifier = blockDefinition.value.identifier

    if (blockDefinition.type == 'ResourceDefinition')
        resourceInfo = await Registry.instance.findProviderResource(identifier, Registry.TYPES['resource']).then(info => info?.resourceInfo)
    else if (blockDefinition.type == 'DataSourceDefinition')
        resourceInfo = await Registry.instance.findProviderResource(identifier, Registry.TYPES['data']).then(info => info?.resourceInfo)

    if (null == resourceInfo) return null
    if (resourceInfo.id in tfDocsAnalyzeCache)
        return tfDocsAnalyzeCache[resourceInfo.id]

    resourceDocumentation = await Registry.instance.getResourceDocs(resourceInfo)
    if (null == resourceDocumentation) return null

    try {
        tfDocsAnalyzeCache[resourceInfo.id] = docsAnalyzer.analyze(resourceDocumentation.data.attributes)
        return tfDocsAnalyzeCache[resourceInfo.id]
    } catch (exception) {
        connection.console.log(exception.message)
        return null
    }

}

connection.onCompletion(async ({ textDocument, position }) => {

    connection.console.log(JSON.stringify(position))
    const document = documents.get(textDocument.uri)

    let currentBlock = null
    for (const definitionBlock of analyzeFile(document)) {

        const range = definitionBlock.value.range
        if (position.line <= range.linestart) continue
        if (position.line >= range.lineend) continue
        currentBlock = definitionBlock
        break

    }

    connection.console.log('-----------------------------------------------------')
    connection.console.log('Currently in Block:')
    connection.console.log(JSON.stringify(currentBlock))
    connection.console.log(`Found Docs For:`)
    connection.console.log(JSON.stringify(await completionMetaForBlock(currentBlock)))
    connection.console.log('-----------------------------------------------------')
})

connection.onCompletionResolve(test => {

    connection.console.log(`Resolve ${JSON.stringify(test)}`)
})

///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Hovering
//////////////////////////////////////////////////////////////////////////////////////////////////////

async function handleProviderResource(identifier, category) {

    connection.console.log(`---------------------------------`)
    connection.console.log(`Search Identifier: ${identifier}`)
    connection.console.log(`Search Category: ${category}`)

    const { resourceInfo, providerInfo } = await Registry.instance.findProviderResource(identifier, category, connection)

    connection.console.log(JSON.stringify(resourceInfo))
    connection.console.log(`---------------------------------`)

    let content = `[**Terraform Registry**](${resourceInfo.docsUrl})`

    return {
        contents: content
    }

}

async function handleProviderModule(document, position) {

    connection.console.log(`---------------------------------`)
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
        connection.console.log('EOF')
    }

    connection.console.log(`Search Module`)
    connection.console.log(`Search Source: '${source}'`)
    connection.console.log(`Search Version: '${version}'`)

    if (null == source) return null


    const moduleInfo = await Registry.instance.getModuleInfo(source, version)
    if (null == moduleInfo) return null

    connection.console.log(`Found Module: '${moduleInfo.id}'`)
    connection.console.log(`---------------------------------`)

    return {
        contents: `[**Terraform Registry**](${moduleInfo.docsUrl})`
    }

}

connection.onHover(async ({ textDocument, position }) => {

    const document = documents.get(textDocument.uri)

    // Get Textline
    const lineStart = Position.create(position.line, 0)
    const lineEnd = Position.create(position.line + 1, 0)
    const lineRange = Range.create(lineStart, lineEnd)

    const fullLine = document.getText(lineRange).replace(/([\r\n]+|[\n]+)/, '')

    const isResourceDefinition = fullLine.match(/resource\s*"[A-Za-z0-9_]+"/)
    const isDatasourceDefinition = fullLine.match(/data\s*"[A-Za-z0-9_]+"/)
    const isModuleDefinition = fullLine.match(/\s*module\s*"[A-Za-z0-9_-]+"/)

    try {

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


    } catch (exception) {
        connection.console.log(exception.message)
    }

    return null
})



///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Initzalizee
//////////////////////////////////////////////////////////////////////////////////////////////////////

connection.onInitialize(params => {

    const result = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            hoverProvider: true,
            completionProvider: true
        }
    }

    return result

})

connection.onInitialized(async () => {

    connection.client.register(DidChangeConfigurationNotification.type, undefined)
    connection.onDidChangeConfiguration(async () => {
        const config = await connection.workspace.getConfiguration({
            section: 'terraform-quick-docs'
        })
        Registry.additionalProviders = config.additional_supported_providers
        connection.console.log(`Changed Settings to: ${JSON.stringify(Registry.additionalProviders)}`)
    })


    const config = await connection.workspace.getConfiguration({
        section: 'terraform-quick-docs'
    })
    Registry.additionalProviders = config.additional_supported_providers
    Registry.clientConnection = connection

    connection.console.log('Init Done')

})

connection.onRequest('provider.list', async () => await Registry.instance.getProvidersFromJson())
connection.onRequest('provider.info', async (identifier) => await Registry.instance.getProviderInfo(identifier))

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)
connection.listen()