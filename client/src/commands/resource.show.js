const vscode = require('vscode')
const Provider = require('../provider')

async function command(client, context) {

    try {

        if (context instanceof Provider.Resource) {
            return await vscode.env.openExternal(vscode.Uri.parse(context.docsUrl))
        }

        // select provider if context is null
        let selectedProvider = context
        if (context == null || !(context instanceof Provider)) {
            const providerOptions = await client.sendRequest('provider.list').then(
                result => result.map(data => {
                    const option = {
                        identifier: data.identifier,
                        label: data.name,
                        description: data.identifier,
                        iconPath: vscode.Uri.parse(`${data.logoEncoding}${data.logoBase64}`)
                    }
                    if (data.fromConfiguration) {
                        option.description = `${data.identifier} (required in Configuration)`
                    }

                    return option
                })
            )
            selectedProvider = await vscode.window.showQuickPick(providerOptions, {
                title: "Choose a Provider"
            })
            if (null == selectedProvider) return
        }


        // display resources in defined order
        const sortOrder = ['overview', 'guides', 'resources', 'data-sources']
        const displayNames = ['Overview', 'Guide', 'Resource', 'Data']
        const info = await client.sendRequest('provider.info', selectedProvider.identifier)
        if (info.error == 'NOT FOUND')
            throw new Error(`'${selectedProvider.identifier}' was not found!`)

        let currentSection = -1
        const resourceOptions = []

        info.docs.sort((a, b) => {
            if (sortOrder.indexOf(a.category) > sortOrder.indexOf(b.category)) return 1
            else if (sortOrder.indexOf(a.category) < sortOrder.indexOf(b.category)) return -1
            else return 0
        }).forEach(resource => {

            if (resource.category != sortOrder[currentSection]) {
                resourceOptions.push({
                    label: displayNames[++currentSection],
                    kind: vscode.QuickPickItemKind.Separator
                })
            }

            resourceOptions.push({
                ...resource,
                label: resource.title,
                description: displayNames[currentSection] //`${displayNames[currentSection]} ${resource.subcategory}`
            })
        })

        // show quick pick selection
        const resource = await vscode.window.showQuickPick(resourceOptions, {
            title: `Choose from ${selectedProvider.identifier}`
        })
        if (null == resource) return


        await vscode.env.openExternal(vscode.Uri.parse(resource.docsUrl))

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}

module.exports = client => vscode.commands.registerCommand('terraform-quick-docs.resource.show', context => command(client, context))