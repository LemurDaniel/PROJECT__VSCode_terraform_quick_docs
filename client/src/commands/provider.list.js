const vscode = require('vscode')

module.exports = async function command(client) {

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

}