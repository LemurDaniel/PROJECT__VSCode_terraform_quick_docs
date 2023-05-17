const vscode = require('vscode')

module.exports = async function command(client) {

    try {

        const functionDocs = await client.sendRequest('functions.data')
        const category = await vscode.window.showQuickPick(functionDocs.data.map(
            category => ({
                ...category,
                label: category.title
            })
        ))
        if (null == category) return

        const functionInfo = await vscode.window.showQuickPick(category.data.map(
            functionInfo => ({
                ...functionInfo,
                label: functionInfo.title,
                description: functionInfo.description?.replace(/`[^`]+`/, '')
            })
        ))
        if (null == functionInfo) return


        await vscode.env.openExternal(
            vscode.Uri.parse(`${functionDocs.baseUrl}/${functionInfo.fullPath}`)
        )

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}