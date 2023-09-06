


/*

const sharp = require('sharp')
const fs = require('fs')

require('./server/src/registry').instance.getProvidersFromApi().then(
    async result => {

        const processedData = []
        for (const provider of result) {

            const buffer = Buffer.from(provider.logoBase64, 'base64')
            const compressed = await sharp(buffer).resize(50, 50).png().toBuffer()
            processedData.push({
                ...provider,
                logoEncoding: "data:image/png;base64,",
                logoBase64: compressed.toString('base64')
            })

        }

        fs.writeFileSync(`${__dirname}/providers.json`, JSON.stringify(processedData), 'UTF-8')

    }
)

*/