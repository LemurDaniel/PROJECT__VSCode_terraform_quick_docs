const vscode = require('vscode')
const Provider = require('./provider')
const Folder = require('./folder')


class ProviderView {

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

        if (element instanceof vscode.TreeItem) {
            return element
        }

        else if (element instanceof Folder) {
            const item = new vscode.TreeItem(element.properties.label)
            item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
            item.contextValue = "folderContext"
            if (null == element.properties.description)
                item.description = element.name
            else if (element.properties.description.length > 0)
                item.description = `/${element.properties.description}`
            else
                item.description = element.properties.description

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

    containsPath(path, subpath) {
        return path.replace(/[\/\\]+/g, '/').includes(subpath.replace(/[\/\\]+/g, '/'))
    }
    reducePath(path, start, end = undefined) {
        return path.split(/[\/\\]+/).slice(start, end).join('/')
    }
    pathSegment(path, segment) {
        return path.split(/[\/\\]+/)[segment]
    }

    // returns topmost required_providers of configurations in all workspaces
    async getRootFolderElemets() {

        const terraformBlockAtPath = await this.#client.sendRequest('requiredprovider.get')

        const rootFolder = new Folder()
        for (const [initialPath, terraform] of Object.entries(terraformBlockAtPath)) {
            const workspaceFolder = vscode.workspace.workspaceFolders.filter(folder => this.containsPath(initialPath, folder.uri.fsPath))[0]
            if (null == workspaceFolder) continue

            // Remove path up until vscode workspace root folder
            const workspacePath = this.reducePath(workspaceFolder.uri.fsPath, 0, -1)
            const reducedPath = initialPath.replace(workspacePath, '')

            // When multiple folders in workspace, shows the foldername as treeitem name 
            if (vscode.workspace.workspaceFolders.length > 1) {
                rootFolder.add(reducedPath, terraform, {
                    label: this.pathSegment(reducedPath, 1),
                    description: this.reducePath(reducedPath, 2)
                })
            }
            // When only one folder, omitts treeitem name
            else {
                rootFolder.add(reducedPath, terraform, {
                    label: null,
                    description: this.reducePath(reducedPath, 2)
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

        const providersList = await this.#client.sendRequest('provider.list', this.identifier)
        const terraformLogo = await this.#client.sendRequest('terraform.logo')

        const providerItems = []
        // Item for showing required terraform version
        const item = new vscode.TreeItem('terraform')
        item.description = content[0].requiredVersion ?? ""
        item.collapsibleState = vscode.TreeItemCollapsibleState.None
        item.iconPath = vscode.Uri.parse(`${terraformLogo.encoding}${terraformLogo.base64}`)
        item.command = {
            "title": "Open Documentation",
            "command": "terraform-quick-docs.documentation.show",
            "arguments": null
        }
        providerItems.push(item)


        // Get provider data from api/cache and create instances of Provider-Class
        for (const { source, version } of Object.values(content[0].requiredProviders)) {
            let providerInfo = await this.#client.sendRequest('provider.info', source)


            providerInfo = new Provider(providerInfo, this.#client)
            

            const item = new vscode.TreeItem(providerInfo.identifier ?? source)
            item.collapsibleState = vscode.TreeItemCollapsibleState.None
            item.contextValue = "providerContext"
            item.description = version

            if (providerInfo.error.providerNotFound) {
                item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('debugConsole.warningForeground'))
            }
            else if (providerInfo.logoData.base64) {
                item.iconPath = vscode.Uri.parse(`${providerInfo.logoData.encoding}${providerInfo.logoData.base64}`)
            }

            item.command = {
                "title": "Open Resources",
                "command": "terraform-quick-docs.resource.show",
                "arguments": [providerInfo]
            }

            providerItems.push(item)
        }

        return providerItems//.concat(element.folders)
    }


}


module.exports = ProviderView