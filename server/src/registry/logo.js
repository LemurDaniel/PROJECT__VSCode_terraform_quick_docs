const fs = require('fs')
const pathUtility = require('path')

const HttpClient = require('./httpClient')
const Cache = require('./cache')

// Once 'sharp' turns out to be unavailable (e.g. missing native binaries),
// stop retrying it for the rest of the process and just serve the fallback logo.
let sharpEnabled = true

function getTerraformLogoData() {
    return JSON.parse(fs.readFileSync(pathUtility.join(__dirname, '..', 'data', 'terraform.logo.json')))
}

async function getBase64Logo(logoUrl, endpoint, clientConnection, size = 50) {

    if (null == logoUrl || !sharpEnabled) {
        return getTerraformLogoData()
    }

    const cached = await Cache.fetch(clientConnection, logoUrl)
    if (null != cached) return cached

    const logoData = {
        url: logoUrl,
        encoding: null,
        base64: null
    }

    try {
        const sharp = require('sharp')

        logoData.url = logoData.url.replace('?3', '')
        if (logoData.url.includes('azure.svg')) {
            logoData.url = '/images/providers/azure.png'
        }
        logoData.url = logoData.url.includes('http') ? logoData.url : `https://${endpoint}/${logoData.url}`

        const rawBase64 = await HttpClient.requestUrl({ url: logoData.url, encoding: 'base64' })
        const compressed = await sharp(Buffer.from(rawBase64, 'base64')).resize(size, size).png().toBuffer()

        logoData.base64 = compressed.toString('base64')
        logoData.encoding = "data:image/png;base64,"

        Cache.set(clientConnection, logoUrl, logoData)

    } catch (err) {
        if (err.message.includes('Cannot find module')) {
            console.log("###  'sharp' is unavailable, disabling logo compression")
            sharpEnabled = false
        }
        console.log(err)
    }

    return logoData
}

module.exports = { getBase64Logo, getTerraformLogoData }
