const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
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




    if (!(fs.existsSync(path.join(context.globalStorageUri.fsPath)))) {
        fs.mkdirSync(path.join(context.globalStorageUri.fsPath), {
            recursive: true
        })
    }

    client.onRequest('cache.fetch', cachePath => {
        cachePath = `${cachePath.replaceAll(/[\\\/]+/g, '.')}.json`.replace(/[/\\?%*:|"<>\s]/g, '_').toLowerCase().substring(0, 200)
        const filePath = path.join(context.globalStorageUri.fsPath, cachePath)
        if (fs.existsSync(filePath)) {
            const cache = JSON.parse(fs.readFileSync(filePath))
            if (cache.expires <= Date.now()) return null
            vscode.window.showInformationMessage(`Fetch Cache: ${cachePath} - ${JSON.stringify(cache.content)}`)
            return cache.content
        }
        else
            return null
    })

    client.onRequest('cache.set', ({ cachePath, data, ttl = Number.MAX_SAFE_INTEGER }) => {
        cachePath = `${cachePath.replaceAll(/[\\\/]+/g, '.')}.json`.replace(/[/\\?%*:|"<>\s]/g, '_').toLowerCase().substring(0, 200)
        vscode.window.showInformationMessage(`Set Cache: ${cachePath} - ${JSON.stringify(data)}`)
        const filePath = path.join(context.globalStorageUri.fsPath, cachePath)
        fs.writeFileSync(filePath, JSON.stringify({
            content: data,
            expires: Date.now() + 1000 * ttl
        }))
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