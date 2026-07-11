const fs = require('fs')
const pathUtility = require('path')

const HttpClient = require('./httpClient')
const Cache = require('./cache')

// Once '@resvg/resvg-wasm' turns out to be unavailable, stop retrying it for the
// rest of the process and just serve svg logos uncompressed instead.
let svgRenderingEnabled = true
let wasmInitialized = false

function getTerraformLogoData() {
    return JSON.parse(fs.readFileSync(pathUtility.join(__dirname, '..', 'data', 'terraform.logo.json')))
}

// Rasterizes an svg buffer to png via a WASM build of resvg, so there is no
// native, platform-specific binary to install (unlike sharp/libvips before it).
async function rasterizeSvg(svgBuffer, size) {
    const { Resvg, initWasm } = require('@resvg/resvg-wasm')

    if (!wasmInitialized) {
        const wasmPath = pathUtility.join(pathUtility.dirname(require.resolve('@resvg/resvg-wasm')), 'index_bg.wasm')
        await initWasm(fs.readFileSync(wasmPath))
        wasmInitialized = true
    }

    const resvg = new Resvg(svgBuffer, { fitTo: { mode: 'width', value: size } })
    return resvg.render().asPng()
}

async function getBase64Logo(logoUrl, endpoint, clientConnection, size = 50) {

    if (null == logoUrl) {
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
        logoData.url = logoData.url.replace('?3', '')
        if (logoData.url.includes('azure.svg')) {
            logoData.url = '/images/providers/azure.png'
        }
        logoData.url = logoData.url.includes('http') ? logoData.url : `https://${endpoint}/${logoData.url}`

        const isSvg = logoData.url.split('?')[0].toLowerCase().endsWith('.svg')
        if (logoData.url.includes('githubusercontent.com')) {
            // GitHub's avatar CDN can thumbnail itself, so no local resizing is needed for these.
            logoData.url = `${logoData.url.split('?')[0]}?s=${size}`
        }

        const rawBase64 = await HttpClient.requestUrl({ url: logoData.url, encoding: 'base64' })

        if (isSvg && svgRenderingEnabled) {
            const png = await rasterizeSvg(Buffer.from(rawBase64, 'base64'), size)
            logoData.base64 = png.toString('base64')
        } else {
            logoData.base64 = rawBase64
        }
        logoData.encoding = "data:image/png;base64,"

        Cache.set(clientConnection, logoUrl, logoData)

    } catch (err) {
        if (err.message.includes('Cannot find module')) {
            console.log("###  '@resvg/resvg-wasm' is unavailable, disabling svg rasterization")
            svgRenderingEnabled = false
        }
        console.log(err)
    }

    return logoData
}

module.exports = { getBase64Logo, getTerraformLogoData }
