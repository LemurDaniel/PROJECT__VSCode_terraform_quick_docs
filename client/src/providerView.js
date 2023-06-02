const vscode = require('vscode')
const Provider = require('./provider')
const Folder = require('./folder')

class ProviderView {

    // View Folder
    static Container = class Container {

        constructor(label, description, elements) {
            this.label = label
            this.description = description
            this.elements = elements
        }
    }

    // Provider View Class
    static #instance

    static init(client) {
        this.#instance = new ProviderView(client)
        return vscode.window.createTreeView('terraform-quick-docs.view.providers', {
            treeDataProvider: this.#instance
        })
    }

    static get instance() {
        if (null == this.#instance) {
            throw new Error('Not initalized')
        }
        return this.#instance
    }




    #onDidChangeTreeData = new vscode.EventEmitter()
    get onDidChangeTreeData() {
        return this.#onDidChangeTreeData.event
    }

    #client
    constructor(client) {
        this.#client = client

        client.onRequest('providerview.refresh', () => this.refresh())
    }





    async getTreeItem(element) {

        const Collapsed = vscode.TreeItemCollapsibleState.Collapsed
        const Expanded = vscode.TreeItemCollapsibleState.Expanded
        const None = vscode.TreeItemCollapsibleState.None

        if (element instanceof Provider) {
            const item = new vscode.TreeItem(element.identifier, None)
            item.contextValue = "providerContext"
            if (element.definedVersion)
                item.description = element.definedVersion

            item.command = {
                "title": "Open Resources",
                "command": "terraform-quick-docs.resource.show",
                "arguments": [element]
            }

            return item
        }
        else if (element instanceof Folder) {
            const item = new vscode.TreeItem(null, Collapsed)
            item.description = element.properties.description ?? element.name
            item.contextValue = "folderContext"

            return item
        }
        else if (element instanceof ProviderView.Container) {
            const item = new vscode.TreeItem(element.label, Expanded)
            item.description = element.description
            item.contextValue = "folderContext"

            return item
        }

    }

    async getChildren(element) {

        if (null == element) {

            const requiredProvidersAtPath = await this.#client.sendRequest('requiredprovider.get')
            
            const rootFolder = new Folder()
            for (const [path, providers] of Object.entries(requiredProvidersAtPath)) {
                const reducedPath = vscode.workspace.workspaceFolders.reduce((path, folder) => path.replace(folder.uri.fsPath, ''), path)

                let folderElements = []
                for (const requiredProvider of Object.values(providers)) {
                    let providerInfo = await this.#client.sendRequest('provider.info', requiredProvider.source)
                    providerInfo = new Provider(providerInfo, this.#client)
                    providerInfo.definedVersion = requiredProvider.version
                    folderElements.push(providerInfo)
                }

                rootFolder.add(reducedPath, folderElements, {
                    description: reducedPath
                })
            }

            const foldersStart = []
            const findSubFolders = current => {
                if (current.content.length > 0)
                    foldersStart.push(current)
                else
                    current.folders.forEach(v => findSubFolders(v))

                return foldersStart
            }

            return findSubFolders(rootFolder).map(folder => folder.name.length > 1 ? folder : folder.content).flat()
        }
        else if (element instanceof ProviderView.Container) {
            return await Promise.resolve(element.elements)
        }
        else if (element instanceof Folder) {
            return element.content //.concat(element.folders)
        }

        return null
    }

    refresh() {
        // fire event from onDidChangeTreeData Event Emitter.
        this.#onDidChangeTreeData.fire()
    }
}


module.exports = ProviderView