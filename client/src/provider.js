class Provider {

    static Resource = class Resource {

        get isDataRead() {
            return this.category?.toLowerCase() == Provider.Categories.Data
        }

        get isResource() {
            return this.category?.toLowerCase() == Provider.Categories.Resource
        }

        get isEphemeral() {
            return this.category?.toLowerCase() == Provider.Categories.Ephemeral
        }

        get isAction() {
            return this.category?.toLowerCase() == Provider.Categories.Action
        }

        get isListResource() {
            return this.category?.toLowerCase() == Provider.Categories.ListResource
        }

        get isFunction() {
            return this.category?.toLowerCase() == Provider.Categories.Function
        }

        get isGuide() {
            return this.category?.toLowerCase() == Provider.Categories.Guide
        }

        get isOverview() {
            return this.category?.toLowerCase() == Provider.Categories.Overview
        }

        constructor(data, provider) {
            this.provider = provider

            this.id = data.id
            this.title = data.title
            this.path = data.path
            this.slug = data.slug
            this.category = data.category
            this.subcategory = data.subcategory
            this.version = data.version
            this.newstVersion = data
            this.docsUrl = data.docsUrl

            this.resourceInfo = data

            this.fulltitle = data.title?.includes(provider.name) ? data.title : `${provider.name}_${data.title}`
            this.baretitle = this.fulltitle?.toLowerCase().replace(provider.name, '')

            if (!this.isDataRead && !this.isResource && !this.isEphemeral && !this.isAction && !this.isListResource) {
                this.fulltitle = data.title
                this.baretitle = data.title
            }

        }
    }

    static Categories = {
        Guide: "guides",
        Data: "data-sources",
        Resource: "resources",
        Ephemeral: "ephemeral-resources",
        Action: "actions",
        ListResource: "list-resources",
        Function: "functions",
        Overview: "overview"
    }

    constructor(data, client) {
        this.error = data.error ?? {}
        this.tier = data.tier
        this.name = data.name
        this.logoData = data.logoData ?? ""
        this.namespace = data.namespace
        this.identifier = data.identifier
        this.fromConfiguration = data.fromConfiguration

        // this.docs = data.docs.map(data => new Provider.Resource(data, this))

        this.client = client
    }

    /*
    async getSubCategories() {
        const resources = await this.getProviderResources()
        const subcategories = [...new Set(resources.map(resource => resource.subcategory))]
        return subcategories
            .filter(subcategory => subcategory.length > 0)
            .sort((a, b) => {
                if (a < b) return -1
                else if (a > b) return 1
                else return 0
            })
    }

    async getBySubcategory(subcategory) {
        const resources = await this.getProviderResources()
        return resources.filter(resource => resource.subcategory == subcategory)
    }

    async getProviderResources() {
        // const result = await this.client.sendRequest('provider.info', this.identifier)
        return this.docs.map(data => new Provider.Resource(data, this))
    }
    */

}


module.exports = Provider