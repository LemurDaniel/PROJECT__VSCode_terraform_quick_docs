const vscode = require('vscode')
const Provider = require('./provider')
const Folder = require('./folder')


class ProviderView {

    static Item = class Item {
        constructor(label, description, data) {
            this.label = label
            this.description = description
            this.data = data
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


    // change events
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

        if (element instanceof ProviderView.Item) {
            const item = new vscode.TreeItem(element.label, None)
            item.description = element.description
            item.contextValue = "itemContext"

            return item
        }
        else if (element instanceof Provider) {
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
            const item = new vscode.TreeItem(element.properties.label, Collapsed)
            if (null != element.properties.description)
                item.description = element.properties.description.length > 0 ? `\\${element.properties.description}` : element.properties.description
            else
                item.description = element.name

            item.contextValue = "folderContext"

            return item
        }

    }

    async getChildren(element) {

        if (null == element) {
            return await this.getRootFolderElemets()
        }

        else if (element instanceof Folder) {
            return await this.getChildItemForFolderContent(element.content)
        }

        return null
    }

    refresh() {
        // fire event from onDidChangeTreeData Event Emitter.
        this.#onDidChangeTreeData.fire()
    }






    // returns topmost required_providers of configurations in all workspaces
    async getRootFolderElemets() {

        const terraformBlockAtPath = await this.#client.sendRequest('requiredprovider.get')

        const rootFolder = new Folder()
        for (const [initialPath, terraform] of Object.entries(terraformBlockAtPath)) {

            const workspaceFolder = vscode.workspace.workspaceFolders.filter(folder => initialPath.includes(folder.uri.fsPath)).at(0)
            if (null == workspaceFolder) continue

            let pathArray = workspaceFolder.uri.fsPath.split('\\')
            pathArray = pathArray.slice(0, pathArray.length - 1)
            const reducedPath = initialPath.replace(pathArray.join('\\'), '')

            // When multiple folders in workspace, shows the foldername as treeitem name 
            if (vscode.workspace.workspaceFolders.length > 1) {
                const pathArray = reducedPath.split('\\')
                rootFolder.add(reducedPath, terraform, {
                    label: pathArray[1],
                    description: pathArray.slice(2).join('\\')
                })
            }
            // When only one folder, omitts treeitem name
            else {
                rootFolder.add(reducedPath, terraform, {
                    label: null,
                    description: reducedPath.split(`\\`).slice(2).join('\\')
                })
            }
        }

        // Find topmost folders in workspaces
        const foldersStart = []
        const findSubFolders = current => {
            if (current.content.length > 0)
                foldersStart.push(current)
            else
                current.folders.forEach(v => findSubFolders(v))

            return foldersStart
        }

        let processedFolders = []
        for (const folder of findSubFolders(rootFolder)) {
            if (folder.properties.label?.length > 0 || folder.properties.description?.length > 0)
                processedFolders.push(folder)
            else {
                const childContent = await this.getChildItemForFolderContent(folder.content)
                processedFolders = [...childContent, ...processedFolders]
            }
        }

        return processedFolders
    }


    // returns terraform version and providers at that path
    async getChildItemForFolderContent(content) {

        let providerItems = Object.values(content[0].requiredProviders)
        // Get provider data from api/cache and create instances of Provider-Class
        providerItems = providerItems.map(requiredProvider =>
            this.#client.sendRequest('provider.info', requiredProvider.source)
                .then(providerInfo => {
                    const provider = new Provider(providerInfo, this.#client)
                    provider.definedVersion = requiredProvider.version
                    return provider
                })
        )
        providerItems = await Promise.all(providerItems)

        // Item for showing required terraform version
        if (content[0].requiredVersion) {
            const item = new ProviderView.Item('terraform', content[0].requiredVersion)
            providerItems = [item, ...providerItems]
        }

        return providerItems//.concat(element.folders)
    }


}


module.exports = ProviderView