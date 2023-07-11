const vscode = require('vscode')
const Provider = require('../provider')

async function command(client, context) {

    try {

        await client.sendRequest('provider.reload')

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}

module.exports = client => vscode.commands.registerCommand('terraform-quick-docs.providers.reload', context => command(client, context))