

const {
    DidChangeConfigurationNotification,
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
} = require('vscode-languageserver/node')

const {
    TextDocument
} = require('vscode-languageserver-textdocument')


///////////////////////////////////////////////////////////////////////////////////////////////////////
////// import custom
//////////////////////////////////////////////////////////////////////////////////////////////////////

const Registry = require('./utility/registry')

const {
    getLinkForPosition
} = require('./capabilities/documentation_link')
const {
    documentsOnDidChangeContent,
    documentsOnDidOpen,
    getCompletionOptions
} = require('./capabilities/completion_options')


///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Initalize
//////////////////////////////////////////////////////////////////////////////////////////////////////

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)
let initDone = false

documents.onDidChangeContent = param => {
    if(!initDone) return
    return documentsOnDidChangeContent(param)
}
documents.onDidOpen = param => {
    if(!initDone) return
    return documentsOnDidOpen(param)
}

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
    initDone = true

})

///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Completion
//////////////////////////////////////////////////////////////////////////////////////////////////////

connection.onCompletion(async ({ textDocument, position }) => {
    return await getCompletionOptions(documents.get(textDocument.uri), position)
})

connection.onCompletionResolve(item => {
    connection.console.log(JSON.stringify(item))
    return item
})

///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Hovering
//////////////////////////////////////////////////////////////////////////////////////////////////////

connection.onHover(async ({ textDocument, position }) => {

    try {
        connection.console.log('HOVER')

        const document = documents.get(textDocument.uri)

        const result = await getLinkForPosition(document, position)
        if (null != result) return result

        const completionOptions = await getCompletionOptions(document, position)
        if(null == completionOptions) return null

        return completionOptions.map(
            option => option.label
        ).join('-')

    } catch (exception) {
        connection.console.log(exception.message)
    }

    return null
})


///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Methods for Client Calls
//////////////////////////////////////////////////////////////////////////////////////////////////////

connection.onRequest('provider.list', async () => await Registry.instance.getProvidersFromJson())
connection.onRequest('provider.info', async (identifier) => await Registry.instance.getProviderInfo(identifier))

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)
connection.listen()