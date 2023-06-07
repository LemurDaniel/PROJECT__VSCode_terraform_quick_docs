const vscode = require('vscode')

async function command(client) {

    try {

        const providers = await client.sendRequest('provider.list').then(
            result => result.map(data => {
                const option = {
                    identifier: data.identifier,
                    label: data.name,
                    description: data.identifier
                }

                if (data.fromConfiguration) {
                    option.description = `${data.identifier} - (required_provider in Configuration)`
                }

                return option
            })
        )
        const selected = await vscode.window.showQuickPick(providers)
        if (null == selected) return

        const info = await client.sendRequest('provider.info', selected.identifier)
        if (info.error == 'NOT FOUND')
            throw new Error(`'${selected.identifier}' was not found!`)

        await vscode.env.openExternal(vscode.Uri.parse(info.docsUrl))

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}

module.exports = client => vscode.commands.registerCommand('terraform-quick-docs.provider.list', () => command(client))