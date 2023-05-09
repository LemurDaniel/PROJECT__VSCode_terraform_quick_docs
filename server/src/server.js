

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



// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

connection.onInitialize(params => {

    const result = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            hoverProvider: true,
            completionProvider: false
        }
    }

    return result
})

connection.onInitialized(async () => {

    const config = await connection.workspace.getConfiguration({
        section: 'terraform-quick-docs'
    })
    Registry.additionalProviders = config.additional_supported_providers
    connection.console.log(JSON.stringify(Registry.additionalProviders))

    connection.client.register(DidChangeConfigurationNotification.type, undefined)
    connection.onDidChangeConfiguration(async () => {
        const config = await connection.workspace.getConfiguration({
            section: 'terraform-quick-docs'
        })
        Registry.additionalProviders = config.additional_supported_providers
        connection.console.log(`Changed Settings to: ${JSON.stringify(Registry.additionalProviders)}`)
    })

    connection.console.log('Init Done')

})


// The content of a text document has changed. This event is emitted
documents.onDidChangeContent(change => { })


async function handleProviderResource(identifier, category) {

    connection.console.log(`---------------------------------`)
    connection.console.log(`Search Identifier: ${identifier}`)
    connection.console.log(`Search Category: ${category}`)

    const { resourceInfo, providerInfo } = await Registry.instance.findProvider(identifier, category, connection)

    connection.console.log(JSON.stringify(resourceInfo))
    connection.console.log(`---------------------------------`)

    let content = `[**Terraform Registry**](${resourceInfo.docsUrl})`

    return {
        contents: content
    }

}

async function handleProviderModule(document, position) {

    connection.console.log(`---------------------------------`)
    connection.console.log(document.constructor.name)
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


    const moduleInfo = await Registry.instance.getModuleInfo(source, version, connection)
    if (null == moduleInfo) return null

    connection.console.log(`Found Module: '${moduleInfo.id}'`)
    connection.console.log(`---------------------------------`)

    return {
        contents: `[**Terraform Registry**](${moduleInfo.docsUrl})`
    }

}

connection.onHover(async ({ textDocument, position }) => {

    const document = documents.get(textDocument.uri)

    connection.console.log(JSON.stringify(position))
    // Get Textline
    const lineStart = Position.create(position.line, 0)
    const lineEnd = Position.create(position.line + 1, 0)
    const lineRange = Range.create(lineStart, lineEnd)

    const fullLine = document.getText(lineRange).replace(/([\r\n]+|[\n]+)/, '')

    const isResourceDefinition = fullLine.match(/resource\s*"[A-Za-z0-9_]+"/)
    const isDatasourceDefinition = fullLine.match(/data\s*"[A-Za-z0-9_]+"/)
    const isModuleDefinition = fullLine.match(/\s*module\s*"[A-Za-z0-9_-]+"/)
    const isDatasourceInline = fullLine.match(/data.[A-Za-z0-9_]+/)
    const isResourceInline = fullLine.match(/[A-Za-z0-9_]+[\.]{1}[A-Za-z0-9_]+/)

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
        else if (isDatasourceInline) {
            const inRange = position.character >= isDatasourceInline.index && position.character <= (isDatasourceInline.index + isDatasourceInline.at(0).length)
            if (inRange) {
                const identifier = isDatasourceInline.at(0).split('.').at(1)
                return await handleProviderResource(identifier, Registry.TYPES['data'])
            }
        }
        else if (isResourceInline) {
            const inRange = position.character >= isResourceInline.index && position.character <= (isResourceInline.index + isResourceInline.at(0).length)
            if (inRange) {
                const identifier = isResourceInline.at(0).split('.').at(0)
                return await handleProviderResource(identifier, Registry.TYPES['resource'])
            }
        }

    } catch (exception) {
        connection.console.log(exception.message)
    }

    return null
})



// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection
connection.listen()