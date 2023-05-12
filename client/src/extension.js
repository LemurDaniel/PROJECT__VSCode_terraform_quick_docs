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

    client.start()


    
    let disposable = vscode.commands.registerCommand('terraform-quick-docs.providers.show', async () => {

        try {

            const providers = await client.sendRequest('provider.list').then(
                result => result.map(data => ({
                    label: data.name,
                    description: data.identifier
                }))
            )
            const selected = await vscode.window.showQuickPick(providers)
            if (null == selected) return

            const info = await client.sendRequest('provider.info', selected.description)
            await vscode.env.openExternal(vscode.Uri.parse(info.docsUrl))

        } catch (exception) {
            vscode.window.showErrorMessage(exception.message)
        }

    })
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