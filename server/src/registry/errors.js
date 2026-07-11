class ProviderNotFoundError extends Error {
    constructor(data) {
        super(`Provider '${data.identifier}' was not Found!`)
        this.providerData = {
            ...data,
            error: {
                providerNotFound: true
            }
        }
    }
}

class ResourceNotFoundError extends Error {
    constructor(message, data) {
        super(message)
        this.data = data
    }
}

module.exports = { ProviderNotFoundError, ResourceNotFoundError }
