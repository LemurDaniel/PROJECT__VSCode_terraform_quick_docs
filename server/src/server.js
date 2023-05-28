

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
} = require('./capabilities/documentation_links')

const {
    analyzeRequiredProviders
} = require('./capabilities/analyze_required_providers')

///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Initalize
//////////////////////////////////////////////////////////////////////////////////////////////////////

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)
let initDone = false

documents.onDidOpen(({ document }) => {

    /*
    if (!initDone) return

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
        Registry.instance
            .findProviderInfo(resourceIdentifier)
            .catch(error => connection.console.log(error.message))
    )
    */

})

documents.onDidSave(async ({ document }) => {

    const fspath = await connection.sendRequest('fspath.get', document.uri)
    analyzeRequiredProviders(fspath, false)
    console.log('analyzed: ${fspath}')
})

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


    // Handling of changed settings in vscode
    const onSettingsChange = async () => {
        const config = await connection.workspace.getConfiguration({
            section: 'terraform-quick-docs'
        })
        Registry.additionalProviders = config.additionalSupportedProviders
        Registry.ignoreVersion = config.alwaysOpenLatestVersion
        Registry.recursionDepth = Number.parseInt(config.recursionDepth)
        connection.console.log(`Changed Settings to: ${JSON.stringify({
            ignoreVersion: Registry.ignoreVersion,
            recursionDepth: Registry.recursionDepth,
            additionalProviders: Registry.additionalProviders
        })}`)
    }
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
    connection.onDidChangeConfiguration(onSettingsChange)

    // Inital configuring of settings
    await onSettingsChange()
    Registry.clientConnection = connection

    const folders = await connection.workspace.getWorkspaceFolders()
    folders?.map(({ uri }) =>
        connection.sendRequest('fspath.get', uri).then(fspath => analyzeRequiredProviders(fspath, true))
    )

    connection.console.log('Init Done')
    initDone = true
})

///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Hovering
//////////////////////////////////////////////////////////////////////////////////////////////////////

connection.onHover(async ({ textDocument, position }) => {

    try {

        const document = documents.get(textDocument.uri)
        const fsPath = await connection.sendRequest('fspath.get', textDocument.uri)
        return await getLinkForPosition(fsPath, document, position)

    } catch (exception) {
        connection.console.log(exception.message)
    }

    return null

})


///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Methods for Client Calls
//////////////////////////////////////////////////////////////////////////////////////////////////////

connection.onRequest('provider.list', async () => await Registry.instance.getProvidersInConfiguration())
connection.onRequest('provider.info', async identifier => await Registry.instance.getProviderInfo(identifier).catch(err => ({ error: 'NOT FOUND' })))
connection.onRequest('functions.data', () => Registry.instance.getFunctionsData())
connection.onRequest('documentation.data', () => Registry.instance.getAllDocumentationData())

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)
connection.listen()