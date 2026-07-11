const nodeUrl = require('node:url')
const https = require('https')

// Runs an https call and buffers the response body as text.
function bufferResponse(startRequest, encoding) {
    return new Promise((resolve, reject) => {
        try {
            const request = startRequest(response => {
                let content = ''
                response.setEncoding(encoding)
                    .on('data', chunk => content += chunk.toString())
                    .on('end', () => resolve(content))
                    .on('error', reject)
            })
            request.end()
        } catch (exception) {
            reject(exception)
        }
    })
}

// Requests a full URL. Note: query strings are dropped, since only the pathname is forwarded.
function requestUrl({ url, method = 'GET', headers = {}, encoding = 'UTF-8' }) {

    const urlData = new nodeUrl.URL(url)

    return bufferResponse(
        callback => https.request({
            method,
            port: 443,
            protocol: 'https:',
            host: urlData.host,
            path: urlData.pathname,
            headers
        }, callback),
        encoding
    )
}

// Requests a hostname + raw path (query string included) and parses the response as JSON.
function requestPath({ hostname, path }) {

    return bufferResponse(
        callback => https.get({
            protocol: 'https:',
            port: 443,
            hostname,
            path,
            headers: {}
        }, callback),
        'utf-8'
    ).then(content => JSON.parse(content))
}

module.exports = { requestUrl, requestPath }
