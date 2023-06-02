const vscode = require('vscode')
const https = require('https')
const Provider = require('../provider')

module.exports = async function command(context, client) {

    try {

        if (context instanceof Provider.Resource) {
            return await vscode.env.openExternal(vscode.Uri.parse(context.docsUrl))
        }

        let selectedProvider = context
        if(context == null || !(context instanceof Provider)) {
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
            selectedProvider = await vscode.window.showQuickPick(providerOptions, {
                title: "Choose a Provider"
            })
            if (null == selectedProvider) return
        }

        const sortOrder = ['overview', 'resources', 'data-sources', 'guides']
        const info = await client.sendRequest('provider.info', selectedProvider.identifier)
        if (info.error == 'NOT FOUND')
            throw new Error(`'${selectedProvider.identifier}' was not found!`)

        const resourceOptions = info.docs
            .map(resource => ({
                ...resource,
                label: resource.title,
                description: resource.category
            }))
            .sort((a, b) => {
                if (sortOrder.indexOf(a.category) > sortOrder.indexOf(b.category)) return 1
                else if (sortOrder.indexOf(a.category) < sortOrder.indexOf(b.category)) return -1
                else return 0
            })

        const resource = await vscode.window.showQuickPick(resourceOptions, {
            title: "Choose a Resource / Data-Source / Guide"
        })
        if (null == resource) return


        await vscode.env.openExternal(vscode.Uri.parse(resource.docsUrl))

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}