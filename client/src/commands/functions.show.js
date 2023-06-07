const vscode = require('vscode')

async function command(client) {

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
                label: functionInfo.syntax[0],
                description: functionInfo.description?.replace(/`[^`]+`/, '')
            })
        ))
        if (null == functionInfo) return


        await vscode.env.openExternal(
            vscode.Uri.parse(`${functionDocs.baseUrl}/${functionInfo.path}`)
        )

    } catch (exception) {
        vscode.window.showErrorMessage(exception.message)
    }

}



module.exports = client => vscode.commands.registerCommand('terraform-quick-docs.functions.show', () => command(client))