const path = require('path')
const {
    LanguageClient,
    TransportKind
} = require('vscode-languageclient/node')



let client = null

function activate(context) {


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
        synchronize: { }
    };

    client = new LanguageClient(
        'terraform-quick-docs',
        'Terraform Quick Docs',
        serverOptions,
        clientOptions
    );

    client.start();

}


// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
    activate,
    deactivate
}