const vscode = require('vscode')
const Provider = require('../provider')

async function command(client, context) {

    try {

        //////////////////////////////////////////////////////////////////
        ////// Show providers

        if (context instanceof Provider.Resource) {
            return await vscode.env.openExternal(vscode.Uri.parse(context.docsUrl))
        }

        // select provider if context is null
        let selectedProvider = context
        if (context == null || !(context instanceof Provider)) {

            const providersList = await client.sendRequest('provider.list').then(
                result => result.sort((a, b) => {
                    if (a.fromConfiguration && b.fromConfiguration) return 0
                    else if (a.fromConfiguration && !b.fromConfiguration) return -1
                    else return 1
                })
            )

            const providerOptions = []

            // Only show the sperators when there are required_providers defined.
            let seperatorIsSet = false
            let requiredProvidersDefined = providersList[0].fromConfiguration
            if (requiredProvidersDefined) {
                providerOptions.push({
                    label: "Terraform Required Providers",
                    kind: vscode.QuickPickItemKind.Separator
                })
            }
            for (const providerData of providersList) {

                if (requiredProvidersDefined && !providerData.fromConfiguration && !seperatorIsSet) {
                    seperatorIsSet = true
                    providerOptions.push({
                        label: "Offical and Partner Providers",
                        kind: vscode.QuickPickItemKind.Separator
                    })
                }

                const option = {
                    identifier: providerData.identifier,
                    label: providerData.name,
                    description: providerData.identifier,
                    iconPath: null
                }

                if (providerData.logoData) {
                    option.iconPath = vscode.Uri.parse(`${providerData.logoData.encoding}${providerData.logoData.base64}`)
                }

                providerOptions.push(option)
            }


            selectedProvider = await vscode.window.showQuickPick(providerOptions, {
                title: "Choose a Provider"
            })
            if (null == selectedProvider) return
        }


        //////////////////////////////////////////////////////////////////
        ////// Show Resources in provider

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