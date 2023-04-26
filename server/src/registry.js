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





    #cache
    constructor() {
        this.#cache = {}
    }

    async get(api) {

        const path = `/${api}`.replace(/[\/]+/g, '/')
        
        if(path in this.#cache) {
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

        const api = "/v1/providers/hashicorp?offset={{offset}}"
        const data = []
        let offset = 0

        do {
            const response = await this.get(api.replace('{{offset}}', offset))
            data.push(response.providers)
            offset = data.meta.next_offset
        } while (null != offset)

        return data

    }

    async getProviderInfo(identifier) {

        return await this.get(`v1/providers/${identifier}`)

    }

}

module.exports = Registry