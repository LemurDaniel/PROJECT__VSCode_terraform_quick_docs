const https = require('https')
const fs = require('fs')

class Registry {

    static #instance = null
    static #endpoint = "registry.terraform.io"

    static get instance() {
        if (null == Registry.#instance) {
            Registry.#instance = new Registry()
        }
        return Registry.#instance
    }

    static #additionalProviders = []
    static get additionalProviders() {
        return Registry.#additionalProviders
    }
    static set additionalProviders(value) {
        Registry.#additionalProviders = (value ?? []).map(entry => ({
            name: entry.split('/')[1],
            namespace: entry.split('/')[0],
            identifier: entry
        }))
    }


    static TYPES = {
        data: 'data-sources',
        resource: 'resources'
    }

    #cache
    constructor() {
        this.#cache = {}
    }

    async get(api) {

        const path = `/${api}`.replace(/[\/]+/g, '/')

        if (path in this.#cache) {
            return this.#cache[path]
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

        this.#cache[path] = response

        return response
    }

    async getProvidersOutJson(path = `${__dirname}\\providers.json`) {

        const providers = await this.getProvidersFromApi()
        fs.writeFileSync(path, JSON.stringify(providers))

    }

    async getProvidersFromJson(path = `${__dirname}\\providers.json`) {

        if (path in this.#cache)
            return Registry.additionalProviders.map(v => v).concat(this.#cache[path])

        this.#cache[path] = JSON.parse(fs.readFileSync(path))

        return await this.getProvidersFromJson(path)

    }

    async getProvidersFromApi() {

        const query = {
            "filter%5Btier%5D": "official%2Cpartner",
            "page%5Bnumber%5D": 1,
            "page%5Bsize%5D": "100",
            "sort": '-downloads%2Ctier%2Cname' //"-featured%2Ctier%2Cname"
        }

        let providers = Registry.additionalProviders.map(v => v)
        let response

        do {
            const queryString = Object.entries(query).map(([key, val]) => `${key}=${val}`).join('&')
            response = await this.get(`/v2/providers?${queryString}`)

            const responseData = response.data.map(data => ({
                name: data.attributes.name,
                namespace: data.attributes.namespace,
                identifier: data.attributes['full-name'],
                tier: data.attributes.tier
            }))
            providers = providers.concat(responseData)

            query['page%5Bnumber%5D'] = response.meta.pagination['next-page']
        } while (null != response.meta.pagination['next-page'])

        return providers

    }

    async getModuleInfo(source, version = null) {

        const docsUrl = `https://${Registry.#endpoint}/modules/{{namespace}}/{{name}}/{{provider}}/{{version}}`
        const moduleInfo = await this.get(`v1/modules/${source}`)

        if (moduleInfo.errors && moduleInfo.errors[0].toLowerCase() == 'not found') return null

        moduleInfo['source'] = source
        moduleInfo['docsUrl'] = docsUrl
            .replace('{{namespace}}', moduleInfo.namespace)
            .replace('{{provider}}', moduleInfo.provider)
            .replace('{{name}}', moduleInfo.name)
            .replace('{{version}}', moduleInfo.versions.includes(version) ? version : moduleInfo.version)

        return moduleInfo
    }

    async getProviderInfo(identifier) {

        const docsUrl = `https://${Registry.#endpoint}/providers/{{namespace}}/{{provider}}/{{version}}/docs`
        const providerInfo = await this.get(`v1/providers/${identifier}`)
        providerInfo['identifier'] = identifier
        providerInfo['docsUrl'] = docsUrl
            .replace('{{namespace}}', providerInfo.namespace)
            .replace('{{provider}}', providerInfo.name)
            .replace('{{version}}', providerInfo.version)

        providerInfo.docs = providerInfo.docs.map(
            resource => ({
                ...resource,
                docsUrl: resource.category == 'overview' ? `${providerInfo.docsUrl}/${resource.category}` : `${providerInfo.docsUrl}/${resource.category}/${resource.slug ?? resource.title}`
            })
        )

        return providerInfo
    }

    async findProviderInfo(resourceIdentifier, connection) {

        const providerName = resourceIdentifier.split('_')[0].toLowerCase()

        connection.console.log(`Search Provider: ${providerName}`)

        const providerData = await this.getProvidersFromJson().then(
            providers => providers.filter(provider => provider.name.toLowerCase() == providerName.toLowerCase())[0]
        )

        if (null == providerData)
            throw new Error(`'${providerName}' not Found!`)

        connection.console.log(`Found Provider: ${providerData.identifier}`)

        const providerInfo = await this.getProviderInfo(providerData.identifier)

        connection.console.log(`Found Providerinfo: ${providerData.identifier}`)

        return providerInfo

    }

    async findProviderResource(resourceIdentifier, resourceCategory, connection) {

        const resourceName = resourceIdentifier
        const secondaryName = resourceIdentifier.split('_').slice(1).join('_')

        const providerInfo = await this.findProviderInfo(resourceIdentifier, connection)
        const resourceInfo = providerInfo.docs.filter(
            resource => (resource.title == resourceName || resource.title == secondaryName) && resource.category == resourceCategory
        )[0]

        if (null == resourceInfo)
            throw new Error(`'${resourceName}' not Found!`)

        connection.console.log(`Found ResourceName: ${resourceInfo.title}`)

        return { resourceInfo: resourceInfo, providerInfo: providerInfo }

    }

    async getResourceDocs(resourceId) {
        return await this.get(`/v2/provider-docs/${resourceId}`)
    }
}

module.exports = Registry