

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
documents.onDidChangeContent(change => {})


connection.onHover(async ({ textDocument, position }) => {

    const document = documents.get(textDocument.uri)

    // Get Textline
    const start = Position.create(position.line, 0)
    const end = Position.create(position.line + 1, 0)
    const range = Range.create(start, end)


    let line = document.getText(range).replace(/([\r\n]+|[\n]+)/, '')
    let category = null

    const isResource = line.match(/\s*resource\s*"[A-Za-z0-9_]+"/) != null
    const isDatasource = line.match(/\s*data\s*"[A-Za-z0-9_]+"/) != null

    if (isDatasource)
        category = Registry.TYPES['data']
    else if (isResource)
        category = Registry.TYPES['resource']
    else
        return

    const identifier = line.match(/"[A-Za-z0-9_]+"/)[0].replace(/"+/g, '')

    connection.console.log(`Search Identifier: ${identifier}`)
    connection.console.log(`Search Category: ${category}`)

    try {
        const { resourceInfo, providerInfo } = await Registry.instance.find(identifier, category, connection)

        connection.console.log(JSON.stringify(resourceInfo))
        let content = `[**Terraform Registry**](${resourceInfo.docsUrl})`

        return {
            contents: content
        }

    } catch (exception) {
        connection.console.log(exception.message)
    }

})



// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection
connection.listen()