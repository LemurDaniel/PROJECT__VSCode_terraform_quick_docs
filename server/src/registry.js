const https = require('https')

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
        Registry.#additionalProviders = value.map(entry => ({
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

    async getProviders() {

        const api = "/v1/providers?offset={{offset}}&limit=100&verified=true"
        const data = {}
        let previousOffset = 0
        let netxtOffset = 0

        do {
            const response = await this.get(api.replace('{{offset}}', netxtOffset))

            response.providers.map(provider => ({
                name: provider.name,
                namespace: provider.namespace,
                identifier: `${provider.namespace}/${provider.name}`
            })).forEach(provider => data[provider.identifier] = provider)

            previousOffset = netxtOffset
            netxtOffset = response.meta.next_offset
        } while (null != netxtOffset && previousOffset != netxtOffset)

        // API doesn't return azure/azapi as a verified provider
        data['azure/azapi'] = {
            name: 'azapi',
            namespace: 'azure',
            identifier: 'azure/azapi'
        }

        Registry.additionalProviders.forEach(providerData =>
            data[providerData.identifier] = providerData
        )

        return data

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
                docsUrl: `${providerInfo.docsUrl}/${resource.category}/${resource.title}`
            })
        )

        return providerInfo
    }

    async findProvider(identifier, resourceCategory, connection) {

        const providerName = identifier.split('_')[0]
        const resourceName = identifier
        const secondaryName = identifier.split('_').slice(1).join('_')

        connection.console.log(`Search Provider: ${providerName}`)

        const providerData = await this.getProviders(connection).then(
            providers => Object.values(providers).filter(provider => provider.name.toLowerCase() == providerName.toLowerCase())[0]
        )

        if (null == providerData)
            throw new Error(`'${providerName}' not Found!`)

        connection.console.log(`Found Provider: ${providerData.identifier}`)

        const providerInfo = await this.getProviderInfo(providerData.identifier)
        const resourceInfo = providerInfo.docs.filter(
            resource => (resource.title == resourceName || resource.title == secondaryName) && resource.category == resourceCategory
        )[0]

        connection.console.log(`Found Providerinfo: ${providerData.identifier}`)

        if (null == resourceInfo)
            throw new Error(`'${resourceName}' not Found!`)

        connection.console.log(`Found ResourceName: ${resourceInfo.title}`)

        return { resourceInfo: resourceInfo, providerInfo: providerInfo }

    }

}

module.exports = Registry