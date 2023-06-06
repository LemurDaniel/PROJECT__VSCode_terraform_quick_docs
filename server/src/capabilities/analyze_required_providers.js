
const fs = require('fs')
const Settings = require('../settings')
const Registry = require('../registry')
const BlockAnalyzer = require('../utility/blockAnalyzer')

let MAX_RECURSION_DEPTH = 10

function* readDirectory(fspath, recursive, recursiondepth = 0) {

    if (recursiondepth >= MAX_RECURSION_DEPTH) return

    fspath = fspath.replace(/[\/\\]+/g, '/')
    //Testing long execution blocking main thread
    //let num = 0
    //while (num <= 1000000000) { num++ }

    const directoryQueue = []
    for (const filename of fs.readdirSync(fspath)) {

        const fullPath = [fspath, filename].join('/')
        if (filename.includes('.')) {
            if (filename.split('.').at(-1) == 'tf')
                yield ({
                    parentpath: fspath,
                    filepath: fullPath
                })
            else
                continue
        }

        const isDirectory = fs.statSync(fullPath).isDirectory()
        if (isDirectory && recursive) directoryQueue.push(fullPath)
    }

    for (const fullPath of directoryQueue) {
        yield* readDirectory(fullPath, recursive, recursiondepth + 1)
    }
}



// Overkill but execute recursive analyazing of files as a thread. Good to not block main-thread, when going through many files recursivley
const Thread = require('node:worker_threads')

async function analyzeRequiredProviders(fsPath, recursive = true) {

    // Start thread if main-thread
    if (recursive && Thread.isMainThread) {
        MAX_RECURSION_DEPTH = Settings.recursionDepth

        const worker = new Thread.Worker(__filename)
        worker.on('message', ({ finished, parentpath, requiredProviders }) => {

            if (finished) {
                return Settings.clientConnection.sendRequest('providerview.refresh', null)
            }

            console.log(`workerthread analyzed '${parentpath}'`)
            Settings.terraformBlock[parentpath] = requiredProviders

            // Fetch API for providers and cache
            Object.values(Settings.terraformBlock[parentpath].requiredProviders).map(
                provider => Registry.instance.getProviderInfo(provider.source, provider.version).catch(error => console.log(error))
            )
        })

        // Call thread to excute on path
        worker.postMessage({ fsPath: fsPath, recursive: recursive, maxRecursionDepth: Settings.recursionDepth })
        console.log('Started Workerthread')
        return null
    }




    // Executed by worked thread
    const blockAnalyzer = new BlockAnalyzer()
    for (const { parentpath, filepath } of readDirectory(fsPath, recursive)) {

        const fileContent = fs.readFileSync(filepath, 'utf-8')
        if (!fileContent.includes('required_providers') && !fileContent.includes('required_version')) continue
        try {

            // analyze tf files for terraform blocl
            const analyzed = blockAnalyzer.analyze(fileContent)
            if (Thread.isMainThread) {
                console.log(`analyzed '${filepath}'`)
            }

            Settings.terraformBlock[parentpath] = {
                requiredVersion: null,
                requiredProviders: {}
            }

            const terraformBlock = analyzed.filter(block => block.type == 'AttributeBlockDefinition' && block.value.identifier == 'terraform').at(0)?.value
            if (terraformBlock) {
                Settings.terraformBlock[parentpath].requiredVersion = terraformBlock.attributes.required_version?.value
                const requiredProviders = terraformBlock.blockDefinitions?.filter(block => block.type == 'AttributeBlockDefinition' && block.value.identifier == 'required_providers').at(0)?.value
                if (requiredProviders) {
                    for (const [provider, value] of Object.entries(requiredProviders.attributes)) {
                        if (!value.attributes?.source?.value) continue
                        const requiredDefinition = {
                            source: value.attributes?.source?.value,
                            version: value.attributes?.version?.value
                        }
                        Settings.terraformBlock[parentpath].requiredProviders[provider] = requiredDefinition
                    }
                }
            }

            // Fetch API for providers and cache if its main thread
            if (Thread.isMainThread) {
                await Settings.clientConnection.sendRequest('providerview.refresh', null)
                await Promise.all(Object.values(Settings.terraformBlock[parentpath].requiredProviders).map(
                    provider => Registry.instance.getProviderInfo(provider.source, provider.version).catch(error => console.log(error))
                ))
            }
            // Inform main thread about results
            else {
                Thread.parentPort.postMessage({
                    parentpath: parentpath,
                    requiredProviders: Settings.terraformBlock[parentpath]
                })
            }

        } catch (exception) {
            console.log(`failed ${parentpath}`)
            console.log(exception.message)
            continue
        }
    }

    if (!Thread.isMainThread) Thread.parentPort.postMessage({ finished: true })

    return

}

if (!Thread.isMainThread) {
    // Listen to parent thread.
    Thread.parentPort.on('message', ({ fsPath, recursive, maxRecursionDepth }) => {
        MAX_RECURSION_DEPTH = maxRecursionDepth
        analyzeRequiredProviders(fsPath, recursive)
    })
}

function removeRequiredProvders(fsPath) {

    const analyzedPaths = Object.keys(Settings.terraformBlock[fsPath])
    for (const path in analyzedPaths) {
        if (path.includes(fsPath))
            delete Settings.terraformBlock[path]
    }

    Settings.clientConnection.sendRequest('providerview.refresh', null)
}

// Find required provider definition based on filepath going upwards to parent directories
async function findRequiredProvider(fsPath, identifier) {

    //console.log(terraformBlock)
    providerShortName = identifier.split('_')[0]
    const segements = fsPath.split(/[\/\\]+/)

    const targetProvider = {
        version: null,
        source: null
    }

    while (segements.length > 0) {
        const parentPath = segements.join('/')

        if (parentPath in Settings.terraformBlock) {

            const requiredProviders = Settings.terraformBlock[parentPath].requiredProviders
            if (providerShortName in requiredProviders) {
                targetProvider.source = requiredProviders[providerShortName].source ?? targetProvider.source
                targetProvider.version = requiredProviders[providerShortName].version ?? targetProvider.version
            }

        }

        segements.pop()
    }

    if (targetProvider.source != null)
        return targetProvider
    else
        return null
}

module.exports = {
    analyzeRequiredProviders,
    removeRequiredProvders,
    findRequiredProvider
}