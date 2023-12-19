

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

const Settings = require('./settings')
const Registry = require('./registry')

const {
    getLinkForPosition
} = require('./capabilities/documentation_links')

const {
    analyzeRequiredProviders,
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
    const fsPath = await connection.sendRequest('fspath.get', document.uri)
    await analyzeRequiredProviders(fsPath, false).catch(error => console.log(error))
})

connection.onInitialize(params => {

    const result = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            hoverProvider: true,
            completionProvider: false,
            workspaceFolders: true
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
        Registry.additionalProviders = [] //config.additionalSupportedProviders
        Settings.ignoreVersion = config.alwaysOpenLatestVersion
        Settings.recursionDepth = Number.parseInt(config.recursionDepth)
        Settings.supportOtherModuleSource = config.supportOtherModuleSource
        connection.console.log(`Changed Settings to: ${JSON.stringify({
            ignoreVersion: Settings.ignoreVersion,
            recursionDepth: Settings.recursionDepth,
            additionalProviders: Registry.additionalProviders,
            supportOtherModuleSource: Settings.supportOtherModuleSource
        })}`)
    }
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
    connection.onDidChangeConfiguration(onSettingsChange)

    // Inital configuring of settings
    await onSettingsChange()
    Settings.clientConnection = connection

    const folders = await connection.workspace.getWorkspaceFolders()
    folders?.map(folder => connection.sendRequest('fspath.get', folder.uri)
        .then(fsPath => analyzeRequiredProviders(fsPath, true))
        .catch(error => console.log(error))
    )


    connection.workspace.onDidChangeWorkspaceFolders(({ added, removed }) => {
        added?.forEach(element => connection.sendRequest('fspath.get', element.uri)
            .then(fsPath => analyzeRequiredProviders(fsPath, true))
            .catch(error => console.log(error))
        )

        if (removed.length > 0) connection.sendRequest('projectview.refresh', null)
    })


    connection.console.log('Init Done')
    initDone = true
})

///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Hovering
//////////////////////////////////////////////////////////////////////////////////////////////////////

connection.onHover(async ({ textDocument, position }) => {

    try {

        const document = documents.get(textDocument.uri)
        return await getLinkForPosition(document, position)

    } catch (exception) {
        connection.console.log(exception.message)
    }

    return null

})


///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Methods for Client Calls
//////////////////////////////////////////////////////////////////////////////////////////////////////

connection.onRequest('provider.reload', async () => {
    Settings.terraformBlock = {}

    const folders = await connection.workspace.getWorkspaceFolders()
    folders?.map(folder => connection.sendRequest('fspath.get', folder.uri)
        .then(fsPath => analyzeRequiredProviders(fsPath, true))
        .catch(error => console.log(error))
    )
})
connection.onRequest('provider.list', async () => await Registry.instance.getProvidersInConfiguration())
connection.onRequest('provider.info', async identifier =>
    await Registry.instance.getProviderInfo(identifier).catch(err =>
        err instanceof Registry.ProviderNotFoundError ? err.providerData : err
    )
)

connection.onRequest('terraform.logo', () => Registry.instance.getTerraformLogoData())
connection.onRequest('functions.data', () => Registry.instance.getFunctionsData())
connection.onRequest('documentation.data', () => Registry.instance.getAllDocumentationData())
connection.onRequest('resource.docs', resourceInfo => Registry.instance.getResourceDocs(resourceInfo))
connection.onRequest('requiredprovider.get', () => Settings.terraformBlock)


// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)
connection.listen()