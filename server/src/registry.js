const pathUtility = require('path')
const fs = require('fs')

const Settings = require('./settings')
const HttpClient = require('./registry/httpClient')
const Cache = require('./registry/cache')
const LogoService = require('./registry/logo')
const { ProviderNotFoundError, ResourceNotFoundError } = require('./registry/errors')
const { builtinResource, builtInProviderFunctions } = require('./registry/builtins')

class Registry {

    static ProviderNotFoundError = ProviderNotFoundError
    static ResourceNotFoundError = ResourceNotFoundError

    static #instance = null
    static #endpoint = "registry.terraform.io"

    static get instance() {
        if (null == Registry.#instance) {
            Registry.#instance = new Registry()
        }
        return Registry.#instance
    }


    // Datatypes for getting resource or data-source
    static TYPES = {
        data: 'data-sources',
        resource: 'resources',
        function: 'function'
    }

    #cache
    constructor() {
        this.#cache = {}
    }

    request(options) {
        return HttpClient.requestUrl(options)
    }

    async get(api, additionalCacheInfo = '', ttl = Number.MAX_SAFE_INTEGER) {

        const path = `/${api}`.replace(/[\/]+/g, '/')
        const cachePath = `${path}/${additionalCacheInfo}`

        const cached = await Cache.fetch(Settings.clientConnection, cachePath)
        if (null != cached) return cached

        const response = await HttpClient.requestPath({ hostname: Registry.#endpoint, path })

        Cache.set(Settings.clientConnection, cachePath, response, ttl)

        return response
    }



    // Read official and partner providers from json
    async getProvidersFromJson(path = pathUtility.join(__dirname, 'data', 'providers.json')) {

        if (!(path in this.#cache)) {
            this.#cache[path] = JSON.parse(fs.readFileSync(path))
        }

        return this.#cache[path]

    }

    // Get all providers in configuration and partner/official providers
    async getProvidersInConfiguration() {

        const defaultProviders = {}
        let providersList = await this.getProvidersFromJson()
        providersList.forEach(
            provider => defaultProviders[provider.identifier.toLowerCase()] = provider
        )

        const providersInConfiguration = {}
        for (const [fullPath, terraform] of Object.entries(Settings.terraformBlock)) {

            for (const [name, data] of Object.entries(terraform.requiredProviders)) {

                const providerSource = data.source.toLowerCase()
                const fsPathSegments = fullPath.split(/[\/\\]+/).length
                const configuredProvider = providersInConfiguration[providerSource]
                if (null != configuredProvider && fsPathSegments >= configuredProvider.segments) {
                    continue
                }


                const configurationDataBlock = {
                    name: providerSource.split(/[\/]+/)[1],
                    identifier: providerSource,
                    namespace: providerSource.split(/[\/]+/)[0],
                    version: data.version ?? configuredProvider?.version,
                    fsPath: fullPath,
                    segments: fsPathSegments,
                    fromConfiguration: true,
                    providerNotFoundError: false
                }

                try {

                    const providerInfo = defaultProviders[providerSource] ?? (await this.getProviderInfo(providerSource))
                    providersInConfiguration[providerSource] = {
                        ...providerInfo,
                        ...configurationDataBlock
                    }

                } catch (error) {
                    if (error instanceof Registry.ProviderNotFoundError) {
                        configurationDataBlock.providerNotFoundError = true
                        providersInConfiguration[providerSource] = configurationDataBlock
                    } else {
                        throw error
                    }
                }
            }
        }

        providersList = providersList.filter(provider => !(provider.identifier.toLowerCase() in providersInConfiguration))
        return Object.values(providersInConfiguration).concat(providersList)

    }

    async getBase64Logo(logoUrl, size = 50) {
        return await LogoService.getBase64Logo(logoUrl, Registry.#endpoint, Settings.clientConnection, size)
    }

    async getProvidersFromApi(downloadLogo = true) {

        const query = {
            "filter%5Btier%5D": "official%2Cpartner",
            "page%5Bnumber%5D": 1,
            "page%5Bsize%5D": "100",
            "sort": '-featured%2Ctier%2Cname' // '-downloads%2Ctier%2Cname' //"-featured%2Ctier%2Cname"
        }

        let response
        let providers = []

        do {
            const queryString = Object.entries(query).map(([key, val]) => `${key}=${val}`).join('&')
            response = await this.get(`/v2/providers?${queryString}`)

            const responseData = []
            for (let i = 0; i < response.data.length; i++) {
                console.log(`processing ${response.data[i].attributes.name}`)
                let data = {
                    name: response.data[i].attributes.name,
                    namespace: response.data[i].attributes.namespace,
                    identifier: response.data[i].attributes['full-name'],
                    tier: response.data[i].attributes.tier,
                    source: response.data[i].attributes.source,
                    logoData: null
                }

                if (downloadLogo) {
                    data.logoData = await this.getBase64Logo(response.data[i].attributes['logo-url'])
                }

                responseData.push(data)
            }
            providers = providers.concat(responseData)

            query['page%5Bnumber%5D'] = response.meta.pagination['next-page']
        } while (null != response.meta.pagination['next-page'])

        return providers

    }

    async getModuleInfo(source, version = null) {

        const docsUrl = `https://${Registry.#endpoint}/modules/{{namespace}}/{{name}}/{{provider}}/{{version}}`

        source = source.split('/').slice(0, 3).join('/')
        const moduleInfo = await this.get(`v1/modules/${source}`, 'module', 12 * 60 * 60)

        if (moduleInfo.errors && moduleInfo.errors[0].toLowerCase() == 'not found') return null

        moduleInfo['source'] = source
        moduleInfo['docsUrl'] = docsUrl
            .replace('{{namespace}}', moduleInfo.namespace)
            .replace('{{provider}}', moduleInfo.provider)
            .replace('{{name}}', moduleInfo.name)
            .replace('{{version}}', moduleInfo.versions.includes(version) ? version : moduleInfo.version)

        return moduleInfo
    }

    // Gets a provider based on an identifier 'namespace/name'
    async getProviderInfo(identifier, version) {

        const docsUrl = `https://${Registry.#endpoint}/providers/{{namespace}}/{{provider}}/{{version}}/docs`
        const endpoint = null != version && !Settings.ignoreVersion ? `v1/providers/${identifier}/${version}` : `v1/providers/${identifier}`
        const providerInfo = await this.get(endpoint, 'provider', 12 * 60 * 60)

        if (null == providerInfo || providerInfo.errors?.at(0)?.includes('not found')) {
            throw new Registry.ProviderNotFoundError({
                identifier: identifier,
                namespace: identifier.split(/[\/]+/)[0],
                name: identifier.split(/[\/]+/)[1]
            })
        }

        providerInfo['identifier'] = identifier
        providerInfo['docsUrl'] = docsUrl
            .replace('{{namespace}}', providerInfo.namespace)
            .replace('{{provider}}', providerInfo.name)
            .replace('{{version}}', providerInfo.version)

        providerInfo.docs = providerInfo.docs.map(
            resource => ({
                ...resource,
                providerVersion: providerInfo.version,
                docsUrl: resource.category == 'overview' ?
                    `${providerInfo.docsUrl}/${resource.category}` :
                    `${providerInfo.docsUrl}/${resource.category}/${resource.slug ?? resource.title}`
            })
        )

        if (providerInfo.tier == 'official' || providerInfo.tier == 'partner') {
            const providerDataJson = await this.getProvidersFromJson()
            providerInfo.logoData = providerDataJson.filter(
                provider => provider.identifier.toUpperCase() == providerInfo.identifier.toUpperCase()
            ).at(0)?.logoData
        }
        else {
            providerInfo.logoData = await this.getBase64Logo(providerInfo.logo_url)
        }

        return providerInfo
    }

    // finds provider based on a resource identifier 'azurerm_bla_bla'
    async findProviderInfo(resourceIdentifier) {

        const providerName = resourceIdentifier.split('_')[0].toLowerCase()

        console.log(`Search Provider: ${providerName}`)
        const providerData = await this.getProvidersFromJson().then(
            providers => providers.filter(provider => provider.name.toLowerCase() == providerName.toLowerCase())[0]
        )

        if (null == providerData)
            throw new Registry.ProviderNotFoundError({
                identifier: providerName,
                namespace: null,
                name: providerName
            })


        console.log(`Found Provider: ${providerData.identifier}`)
        const providerInfo = await this.getProviderInfo(providerData.identifier)
        console.log(`Found Providerinfo: ${providerData.identifier}`)

        return providerInfo

    }

    // finds provider resource based on a resource identifier 'azurerm_bla_bla' and a category
    async findProviderResource(resourceIdentifier, resourceCategory) {

        if (resourceIdentifier in builtinResource) {
            return {
                resourceInfo: builtinResource[resourceIdentifier],
                providerInfo: null
            }
        } else if (resourceIdentifier in builtInProviderFunctions) {
            return {
                resourceInfo: builtInProviderFunctions[resourceIdentifier],
                providerInfo: null
            }
        }

        const resourceName = resourceIdentifier
        const secondaryName = resourceIdentifier.split('_').slice(1).join('_')

        const providerInfo = await this.findProviderInfo(resourceIdentifier)
        const resourceInfo = providerInfo.docs.filter(
            resource => (resource.title == resourceName || resource.title == secondaryName) && resource.category == resourceCategory
        )[0]

        if (null == resourceInfo)
            throw new Registry.ResourceNotFoundError(`'${resourceName}' not Found!`)

        console.log(`Found ResourceName: ${resourceInfo.title}`)
        return { resourceInfo: resourceInfo, providerInfo: providerInfo }

    }

    // gets a resource from a specific provder with version
    getProviderResource(providerInfo, resourceIdentifier, resourceCategory) {
        const resourceName = resourceIdentifier.split('_').slice(1).join('_')
        return providerInfo.docs.filter(
            resource => (resource.title == resourceName || resource.title == resourceIdentifier) && resource.category == resourceCategory
        )[0]
    }

    async getResourceDocs(resourceInfo) {
        return await this.get(`/v2/provider-docs/${resourceInfo.id}`, resourceInfo.providerVersion).then(result => result.data)
    }



    getTerraformLogoData() {
        return LogoService.getTerraformLogoData()
    }
    getFunctionsFlat() {
        return this.getFunctionsData().data.map(category => category.data).flat()
    }
    getFunctionsData() {
        return this.getAllDocumentationData().data.filter(docs => docs.title?.toLowerCase() == 'functions')[0]
    }
    getAllDocumentationData() {
        if (!("documentation" in this.#cache)) {
            this.#cache["documentation"] = JSON.parse(fs.readFileSync(`${__dirname}/data/documentation.json`))
        }
        return this.#cache["documentation"]
    }
}

module.exports = Registry