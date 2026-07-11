const vscode = require('vscode')
const Provider = require('../provider')


const sortOrder = ['overview', 'guides', 'actions', 'list-resources', 'ephemeral-resources', 'resources', 'data-sources', 'functions']
const displayNames = ['Overview', 'Guide', 'Action', 'List Resource', 'Ephemeral', 'Resource', 'Data', 'Function']

async function command(client, context) {

    try {

        if (context instanceof Provider.Resource) {
            return await vscode.env.openExternal(vscode.Uri.parse(context.docsUrl))
        }

        // select provider if context is null
        let selectedProvider = context
        if (context == null || !(context instanceof Provider)) {
            selectedProvider = await selectProvider(client)
            if (null == selectedProvider) return
        }

        const resource = await selectResource(client, selectedProvider)
        if (null == resource) return

        await vscode.env.openExternal(vscode.Uri.parse(resource.docsUrl))

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}

module.exports = client => vscode.commands.registerCommand('terraform-quick-docs.resource.show', context => command(client, context))


function createProviderOption(providerData) {

    const option = {
        identifier: providerData.identifier,
        label: providerData.name,
        description: providerData.identifier,
        iconPath: null
    }

    if (providerData.providerNotFoundError) {
        option.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('debugConsole.warningForeground'))
    }
    else if (providerData.logoData) {
        option.iconPath = vscode.Uri.parse(`${providerData.logoData.encoding}${providerData.logoData.base64}`)
    }

    return option
}

function pushProviderSection(providerOptions, label, providers) {
    providerOptions.push({
        label: label,
        kind: vscode.QuickPickItemKind.Separator
    })
    providers.forEach(providerData => providerOptions.push(createProviderOption(providerData)))
}

async function selectProvider(client) {

    const providersList = await client.sendRequest('provider.list').then(
        result => result.sort((a, b) => {
            if (a.fromConfiguration && b.fromConfiguration) return 0
            else if (a.fromConfiguration && !b.fromConfiguration) return -1
            else return 1
        })
    )

    const requiredProviders = providersList.filter(provider => provider.fromConfiguration)
    const remainingProviders = providersList.filter(provider => !provider.fromConfiguration)

    const providerOptions = []

    // Only show the sperators when there are required_providers defined.
    if (remainingProviders.length > 0) {
        pushProviderSection(providerOptions, "Terraform Required Providers", requiredProviders)
    }
    pushProviderSection(providerOptions, "Offical and Partner Providers", remainingProviders)

    return await vscode.window.showQuickPick(providerOptions, {
        title: "Choose a Provider"
    })
}

function buildResourceOptions(docs) {

    // This is to prevent multiple entries of the same resource/data due to terraform multi-language-documentations.
    const uniqueElements = {}
    docs.forEach(
        doc => uniqueElements[`${doc.category}-${doc.title}`] = doc
    )

    let previousCategory = null
    const resourceOptions = []

    Object.values(uniqueElements).sort((a, b) => {
        if (sortOrder.indexOf(a.category) > sortOrder.indexOf(b.category)) return 1
        else if (sortOrder.indexOf(a.category) < sortOrder.indexOf(b.category)) return -1
        else return 0
    }).forEach(resource => {
        const displayName = displayNames[sortOrder.indexOf(resource.category)]

        if (resource.category != previousCategory) {
            previousCategory = resource.category
            resourceOptions.push({
                label: displayName,
                kind: vscode.QuickPickItemKind.Separator
            })
        }

        resourceOptions.push({
            ...resource,
            label: resource.title,
            description: displayName
        })
    })

    return resourceOptions
}

async function selectResource(client, provider) {

    const providerInfo = await client.sendRequest('provider.info', provider.identifier)

    if (providerInfo.error?.providerNotFound) {
        throw new Error(`'${providerInfo.identifier}' was not found! Please check the spelling!`)
    }

    return await vscode.window.showQuickPick(buildResourceOptions(providerInfo.docs), {
        title: `Choose from ${provider.identifier}`
    })
}