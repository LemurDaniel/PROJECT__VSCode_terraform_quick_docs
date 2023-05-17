const vscode = require('vscode')

module.exports = async function command(client) {

    try {

        const documentationData = await client.sendRequest('documentation.data')
        let documentationResource = documentationData
        do {
            documentationResource = await vscode.window.showQuickPick(documentationResource.data.map(
                category => ({
                    label: category.title,
                    ...category
                })
            ))
            if (null == documentationResource) return
        } while ("data" in documentationResource)

        await vscode.env.openExternal(
            vscode.Uri.parse(`${documentationData.baseUrl}/${documentationResource.fullPath}`)
        )

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}