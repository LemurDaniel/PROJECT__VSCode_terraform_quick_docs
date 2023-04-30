

const {
    createConnection,
    CompletionItemKind,
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
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);


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

connection.onInitialized(() => {
    connection.console.log('Init Done')
})


// The content of a text document has changed. This event is emitted
documents.onDidChangeContent(change => { })



async function handleProviderResource(line, category) {

    const identifier = line.match(/"[A-Za-z0-9_]+"/)[0].replace(/"+/g, '')

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

    // Get Textline
    const start = Position.create(position.line, 0)
    const end = Position.create(position.line + 1, 0)
    const range = Range.create(start, end)

    const line = document.getText(range).replace(/([\r\n]+|[\n]+)/, '')

    const isResource = line.match(/\s*resource\s*"[A-Za-z0-9_]+"/) != null
    const isDatasource = line.match(/\s*data\s*"[A-Za-z0-9_]+"/) != null
    const isModule = line.match(/\s*module\s*"[A-Za-z0-9_-]+"/) != null

    try {

        if (isResource)
            return handleProviderResource(line, Registry.TYPES['resource'])
        else if (isDatasource)
            return handleProviderResource(line, Registry.TYPES['data'])
        else if (isModule)
            return handleProviderModule(document, position)
        else
            return null

    } catch (exception) {
        connection.console.log(exception.message)
    }
})



// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection
connection.listen()