

const {
    createConnection,
    CompletionItemKind,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
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
            completionProvider: {
                resolveProvider: true
            }
        }
    }

    return result
})

connection.onInitialized(() => {
    connection.console.log('Init Done')
})


// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    connection.console.log('Event received')

    // connection.console.log(JSON.stringify(CompletionItemKind))
})


connection.onCompletion(async _textDocumentPosition => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.

    const test = await Registry.instance.getProviderInfo('hashicorp/azurerm')

    return test.docs.filter(v => !v.title.includes(' ')).map(element => ({
            label: element.title,
            kind: CompletionItemKind.Text,
            data: element.id
        })
    )

})

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(async item => {

    const test = await Registry.instance.getProviderInfo('hashicorp/azurerm')

    return test.docs.filter(v => v.id == item.data).map(v => ({
        ...v,
        detail: "test test TESt",
        documentation: "Some testing" 
    }))
})


// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection
connection.listen()