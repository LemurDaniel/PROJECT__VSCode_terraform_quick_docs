const pathUtility = require('path')
const nodeUrl = require('node:url')
const https = require('https')
const sharp = require('sharp')
const fs = require('fs')

const Settings = require('./settings')

class Registry {

    static #builtinResource = {
        "terraform_data": {
            isBuiltin: true,
            docsUrl: "https://developer.hashicorp.com/terraform/language/resources/terraform-data"
        }
    }

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
        resource: 'resources'
    }

    #cache
    constructor() {
        this.#cache = {}
    }

    request(options) {

        const urlData = new nodeUrl.URL(options.url)
        return new Promise((resolve, reject) => {
            try {
                const request = https.request({
                    method: options.method ?? 'GET',
                    port: 443,
                    protocol: 'https:',
                    host: urlData.host,
                    path: urlData.pathname,
                    headers: options.headers ?? {}
                }, response => {
                    let content = ''
                    response.setEncoding(options.encoding ?? 'UTF-8')
                        .on('data', e => content += e.toString())
                        .on('end', e => resolve(content))
                        .on('error', reject)
                })
                request.end()
            } catch (exception) {
                reject(exception)
            }
        })

    }

    async get(api, additionalCacheInfo = '', ttl = Number.MAX_SAFE_INTEGER) {

        const path = `/${api}`.replace(/[\/]+/g, '/')
        const cachePath = `${path}/${additionalCacheInfo}`

        if (null != Settings.clientConnection) {
            const cache = await Settings.clientConnection.sendRequest('cache.fetch', cachePath)
            if (null != cache) return cache
        }

        const response = await new Promise((resolve, reject) => {
            try {
                const request = https.get({
                    protocol: 'https:',
                    port: 443,
                    hostname: Registry.#endpoint,
                    path: path,
                    headers: {}
                }, response => {
                    let content = ''
                    response.setEncoding('utf-8')
                        .on('data', e => content += e.toString())
                        .on('end', e => resolve(JSON.parse(content)))
                        .on('error', reject)
                })
                request.end()
            } catch (exception) {
                reject(exception)
            }
        })

        if (null != Settings.clientConnection) {
            Settings.clientConnection.sendRequest('cache.set', {
                cachePath: cachePath,
                data: response,
                ttl: ttl
            })
        }

        return response
    }

    async getProvidersOutJson(path = pathUtility.join(__dirname, 'data', 'providers.json')) {

        const providers = await this.getProvidersFromApi()
        fs.writeFileSync(path, JSON.stringify(providers))

    }

    async getProvidersFromJson(path = pathUtility.join(__dirname, 'data', 'providers.json')) {

        if (path in this.#cache)
            return this.#cache[path]

        this.#cache[path] = JSON.parse(fs.readFileSync(path))

        return await this.getProvidersFromJson(path)

    }

    async getProvidersInConfiguration() {

        const defaultProviders = {}
        let providersList = await this.getProvidersFromJson()
        providersList.forEach(provider => defaultProviders[provider.identifier.toLowerCase()] = provider)

        const providersInConfiguration = {}
        for (const [fullPath, terraform] of Object.entries(Settings.terraformBlock)) {

            for (const [name, data] of Object.entries(terraform.requiredProviders)) {

                const configuredProvider = providersInConfiguration[data.source.toLowerCase()]
                let providerInfo = defaultProviders[data.source.toLowerCase()]

                if (null != configuredProvider && fullPath.split(/[\/\\]+/).length >= configuredProvider.segments) {
                    continue
                }

                if (providerInfo == null) {
                    providerInfo = await this.getProviderInfo(data.source.toLowerCase())
                }

                providersInConfiguration[data.source.toLowerCase()] = {
                    ...providerInfo,
                    version: data.version ?? configuredProvider?.version,
                    fsPath: fullPath,
                    segments: fullPath.split(/[\/\\]+/).length,
                    fromConfiguration: true
                }
            }

        }

        providersList = providersList.filter(provider => !(provider.identifier.toLowerCase() in providersInConfiguration))
        return Object.values(providersInConfiguration).concat(providersList)

    }

    async getBase64Logo(logoUrl, size = 50) {

        if (null != Settings.clientConnection) {
            const cache = await Settings.clientConnection.sendRequest('cache.fetch', logoUrl)
            if (null != cache) return cache
        }

        const logoData = {
            url: logoUrl,
            encoding: null,
            base64: null
        }

        try {
            logoData.url = logoData.url.replace('?3', '')
            if (logoData.url.includes('azure.svg')) {
                logoData.url = '/images/providers/azure.png'
            }
            logoData.url = logoData.url.includes('http') ? logoData.url : `https://${Registry.#endpoint}/${logoData.url}`

            logoData.base64 = await this.request({
                url: logoData.url,
                encoding: 'base64'
            })

            const buffer = Buffer.from(logoData.base64, 'base64')
            const compressed = await sharp(buffer).resize(50, 50).png().toBuffer()
            logoData.base64 = compressed.toString('base64')
            logoData.encoding = "data:image/png;base64,"

            //if (logoData.url.includes('svg'))
            //    logoData.logoEncoding = `data:image/svg+xml;base64,`
            //else
            //    logoData.logoEncoding = `data:image/png;base64,`

            if (null != Settings.clientConnection) {
                Settings.clientConnection.sendRequest('cache.set', {
                    cachePath: logoUrl,
                    data: logoData,
                    ttl: Number.MAX_SAFE_INTEGER
                })
            }

        } catch (err) {
            console.log(err)
        }

        return logoData
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
                    source: response.data[i].attributes.source
                }

                if (downloadLogo) {
                    const logoData = await this.getBase64Logo(response.data[i].attributes['logo-url'])
                    data = { ...data, logoData }
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

        if (null == providerInfo || providerInfo.errors?.at(0)?.toLowerCase() == 'not found') {
            throw new Error(`Not Found: ${identifier}`, endpoint)
        }

        providerInfo['identifier'] = identifier
        providerInfo['docsUrl'] = docsUrl
            .replace('{{namespace}}', providerInfo.namespace)
            .replace('{{provider}}', providerInfo.name)
            .replace('{{version}}', providerInfo.version)

        const uniqueResources = {}
        providerInfo.docs.forEach(
            resource => uniqueResources[resource.slug ?? resource.title] = ({
                ...resource,
                providerVersion: providerInfo.version,
                docsUrl: resource.category == 'overview' ? `${providerInfo.docsUrl}/${resource.category}` : `${providerInfo.docsUrl}/${resource.category}/${resource.slug ?? resource.title}`
            })
        )
        providerInfo.docs = Object.values(uniqueResources)

        if (providerInfo.tier == 'official' || providerInfo.tier == 'partner') {
            const providerDataJson = await this.getProvidersFromJson()
            providerInfo.logoData = providerDataJson.filter(provider => provider.identifier == providerInfo.identifier)[0].logoData
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
            throw new Error(`'${providerName}' not Found!`)


        console.log(`Found Provider: ${providerData.identifier}`)
        const providerInfo = await this.getProviderInfo(providerData.identifier)
        console.log(`Found Providerinfo: ${providerData.identifier}`)

        return providerInfo

    }

    // finds provider resource based on a resource identifier 'azurerm_bla_bla' and a category
    async findProviderResource(resourceIdentifier, resourceCategory) {

        if (resourceIdentifier in Registry.#builtinResource) {
            return { resourceInfo: Registry.#builtinResource[resourceIdentifier], providerInfo: null }
        }

        const resourceName = resourceIdentifier
        const secondaryName = resourceIdentifier.split('_').slice(1).join('_')

        const providerInfo = await this.findProviderInfo(resourceIdentifier)
        const resourceInfo = providerInfo.docs.filter(
            resource => (resource.title == resourceName || resource.title == secondaryName) && resource.category == resourceCategory
        )[0]

        if (null == resourceInfo)
            throw new Error(`'${resourceName}' not Found!`)

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




    getFunctionsFlat() {
        return this.getFunctionsData().data.map(category => category.data).flat()
    }
    getFunctionsData() {
        if ("functionData" in this.#cache) return this.#cache["functionData"]
        this.#cache["functionData"] = this.getAllDocumentationData().data.filter(docs => docs.title.toLowerCase() == 'functions')[0]
        return this.getFunctionsData()
    }
    getAllDocumentationData() {
        return JSON.parse(fs.readFileSync(`${__dirname}/data/documentation.json`))
    }
}

module.exports = Registry