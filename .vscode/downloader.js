
const fs = require('fs')
const registry = require('../server/src/registry')


async function downloader() {

    const targetFile = `${__dirname}/../server/src/data/providers.json`

    const providers = await registry.instance.getProvidersFromApi()
    fs.writeFileSync(targetFile, JSON.stringify(providers), 'UTF-8')

}


downloader()