const vscode = require('vscode')

module.exports = async function command(client) {

    try {

        const providerOptions = await client.sendRequest('provider.list').then(
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
        const selected = await vscode.window.showQuickPick(providerOptions, {
            title: "Choose a Provider"
        })
        if (null == selected) return


        const sortOrder = ['overview', 'resources', 'data-sources', 'guides']
        const resourceOptions = await client.sendRequest('provider.info', selected.identifier).then(
            data => data.docs.map(resource => ({
                ...resource,
                label: resource.title,
                description: resource.category
            })).sort((a, b) => {
                if (sortOrder.indexOf(a.category) > sortOrder.indexOf(b.category)) return 1
                else if (sortOrder.indexOf(a.category) < sortOrder.indexOf(b.category)) return -1
                else return 0
            })
        )
        const resource = await vscode.window.showQuickPick(resourceOptions, {
            title: "Choose a Resource / Data-Source / Guide"
        })
        if (null == resource) return

        
        await vscode.env.openExternal(vscode.Uri.parse(resource.docsUrl))

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}