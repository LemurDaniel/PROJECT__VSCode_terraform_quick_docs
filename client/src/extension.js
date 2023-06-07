const ProviderView = require('./providerView')
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
            pattern: '**/*.tf',
        }],
        synchronize: {}
    };

    client = new LanguageClient(
        'terraform-quick-docs',
        'Terraform Quick Docs',
        serverOptions,
        clientOptions
    );


    // Register Client Methods
    client.onRequest('fspath.get', uri => {
        let fspath = vscode.Uri.parse(uri).fsPath.replace(/[\/\\]+/g, '/')
        if (!fs.statSync(fspath).isDirectory())
            return fspath.split('/').slice(0, -1).join('/')
        else
            return fspath
    })

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
            //vscode.window.showInformationMessage(`Fetch Cache: ${cachePath} - ${JSON.stringify(cache.content)}`)
            return cache.content
        }
        else
            return null
    })

    client.onRequest('cache.set', ({ cachePath, data, ttl = Number.MAX_SAFE_INTEGER }) => {
        cachePath = `${cachePath.replaceAll(/[\\\/]+/g, '.')}.json`.replace(/[/\\?%*:|"<>\s]/g, '_').toLowerCase().substring(0, 200)
        //vscode.window.showInformationMessage(`Set Cache: ${cachePath} - ${JSON.stringify(data)}`)
        const filePath = path.join(context.globalStorageUri.fsPath, cachePath)
        fs.writeFileSync(filePath, JSON.stringify({
            content: data,
            expires: Date.now() + 1000 * ttl
        }))
    })



    // Register Commands
    context.subscriptions.push(require('./commands/functions.show')(client))
    context.subscriptions.push(require('./commands/provider.list')(client))
    context.subscriptions.push(require('./commands/resource.show')(client))
    context.subscriptions.push(require('./commands/documentation.show')(client))


    // Register View
    context.subscriptions.push(ProviderView.init(client))

    // Start
    client.start()
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