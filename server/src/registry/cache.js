// Thin wrapper around the client's cache request/notification pair, so callers
// don't have to guard against a missing clientConnection at every call site.

async function fetch(clientConnection, key) {
    if (null == clientConnection) return null
    return await clientConnection.sendRequest('cache.fetch', key)
}

function set(clientConnection, key, data, ttl = Number.MAX_SAFE_INTEGER) {
    if (null == clientConnection) return
    clientConnection.sendRequest('cache.set', { cachePath: key, data, ttl })
}

module.exports = { fetch, set }
