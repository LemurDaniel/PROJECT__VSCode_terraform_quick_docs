const vscode = require('vscode')
const { toQuickPickOptions } = require('./utility/quickPick')

async function command(client) {

    try {

        const documentationData = await client.sendRequest('documentation.data')
        let documentationResource = documentationData
        do {
            const documentationOptions = toQuickPickOptions(documentationResource.data,
                category => ({ label: category.title, ...category })
            )
            documentationResource = await vscode.window.showQuickPick(documentationOptions)

            if (null == documentationResource) return
            if (documentationResource.id == "documentation.functions")
                return await vscode.commands.executeCommand('terraform-quick-docs.functions.show')

        } while (null != documentationResource.data)

        await vscode.env.openExternal(
            vscode.Uri.parse(`${documentationData.baseUrl}/${documentationResource.path}`)
        )

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}



module.exports = client => vscode.commands.registerCommand('terraform-quick-docs.documentation.show', () => command(client))