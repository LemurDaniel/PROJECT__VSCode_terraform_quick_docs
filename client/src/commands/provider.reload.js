const vscode = require('vscode')

async function command(client) {

    try {
        await client.sendRequest('provider.reload')
    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}

module.exports = client => vscode.commands.registerCommand('terraform-quick-docs.providers.reload', () => command(client))