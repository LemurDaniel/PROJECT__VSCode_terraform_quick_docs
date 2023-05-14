const vscode = require('vscode')
const path = require('path')
const {
    LanguageClient,
    TransportKind
} = require('vscode-languageclient/node')


let client = null

async function activate(context) {

    const serverModule = context.asAbsolutePath(
        path.join('server', 'src', 'server.js')
    )

    const serverOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        }
    }

    const clientOptions = {
        documentSelector: [{
            scheme: 'file',
            language: 'terraform'
        }],
        synchronize: {}
    };

    client = new LanguageClient(
        'terraform-quick-docs',
        'Terraform Quick Docs',
        serverOptions,
        clientOptions
    );

    client.onRequest('cache.fetch', path => {
        const cache = context.globalState.get(path)
        vscode.window.showInformationMessage(`Fetch Cache: ${path} - ${JSON.stringify(cache)}`)
        return cache
    })

    client.onRequest('cache.set', ({ path, data }) => {
        vscode.window.showInformationMessage(`Set Cache: ${path} - ${JSON.stringify(data)}`)
        context.globalState.update(path, data)
    })

    client.start()


    const listProviders = require('./commands/provider.list')
    let disposable = vscode.commands.registerCommand('terraform-quick-docs.providers.list',
        async () => await listProviders(client)
    )
    context.subscriptions.push(disposable)

    const showResources = require('./commands/resource.show')
    disposable = vscode.commands.registerCommand('terraform-quick-docs.resource.show',
        async () => await showResources(client)
    )
    context.subscriptions.push(disposable)
}



// This method is called when your extension is deactivated
function deactivate(context) {
    if (client) return client.stop()
    context.subscriptions.forEach(disposable => disposable.dispose())
}

module.exports = {
    activate,
    deactivate
}