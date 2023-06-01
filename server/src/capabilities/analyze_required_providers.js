
const fs = require('fs')
const Settings = require('../settings')
const Registry = require('../registry')
const BlockAnalyzer = require('../utility/blockAnalyzer')

let MAX_RECURSION_DEPTH = 10

function* readDirectory(fspath, recursive, recursiondepth = 0) {

    if (recursiondepth >= MAX_RECURSION_DEPTH) return

    //Testing long execution blocking main thread
    //let num = 0
    //while (num <= 1000000000) { num++ }

    const directoryQueue = []
    for (const filename of fs.readdirSync(fspath)) {

        const fullPath = `${fspath}\\${filename}`
        if (filename.includes('.')) {
            if (filename.split('.').at(-1) == 'tf')
                yield ({ parentpath: fspath, filepath: fullPath })
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
        worker.on('message', ({ parentpath, requiredProviders }) => {

            console.log(`workerthread analyzed '${parentpath}'`)
            Settings.clientConnection.sendRequest('providerview.refresh', null)
            Settings.requiredProvidersAtPath[parentpath] = requiredProviders
            // Fetch API for providers and cache
            Object.values(Settings.requiredProvidersAtPath[parentpath]).map(
                provider => Registry.instance.getProviderInfo(provider.source, provider.version).catch(error => console.log(error))
            )
        })

        // Call thread to excute on path
        worker.postMessage({ fsPath: fsPath, recursive: recursive, maxRecursionDepth: Settings.recursionDepth })
        return null
    }

    // Executed by worked thread
    const blockAnalyzer = new BlockAnalyzer()
    for (const { parentpath, filepath } of readDirectory(fsPath, recursive)) {

        const fileContent = fs.readFileSync(filepath, 'utf-8')
        if (!fileContent.includes('required_providers')) continue
        try {
            const analyzed = blockAnalyzer.analyze(fileContent)

            if (Thread.isMainThread) {
                console.log(`analyzed '${filepath}'`)
            }

            const terraformBlock = analyzed.filter(block => block.type == 'AttributeBlockDefinition' && block.value.identifier == 'terraform').at(0)?.value
            if (!terraformBlock) continue
            const requiredProviders = terraformBlock.blockDefinitions.filter(block => block.type == 'AttributeBlockDefinition' && block.value.identifier == 'required_providers').at(0)?.value
            if (!requiredProviders) continue


            Settings.requiredProvidersAtPath[parentpath] = {}
            for (const [provider, value] of Object.entries(requiredProviders.attributes)) {
                if (!value.attributes?.source?.value) continue
                Settings.requiredProvidersAtPath[parentpath][provider] = {
                    source: value.attributes?.source?.value,
                    version: value.attributes?.version?.value
                }
            }

            if (Thread.isMainThread) {
                // Fetch API for providers and cache
                await Promise.all(Object.values(Settings.requiredProvidersAtPath[parentpath]).map(
                    provider => Registry.instance.getProviderInfo(provider.source, provider.version).catch(error => console.log(error))
                ))
            }
            // Inform main thread about results
            else {
                Thread.parentPort.postMessage({
                    parentpath: parentpath,
                    requiredProviders: Settings.requiredProvidersAtPath[parentpath]
                })
            }

        } catch (exception) {
            console.log(`failed ${parentpath}`)
            console.log(exception.message)
            continue
        }
    }

    return

}

if (!Thread.isMainThread) {
    // Listen to parent thread.
    Thread.parentPort.on('message', ({ fsPath, recursive, maxRecursionDepth }) => {
        MAX_RECURSION_DEPTH = maxRecursionDepth
        analyzeRequiredProviders(fsPath, recursive)
    })
}


// Find required provider definition based on filepath going upwards to parent directories
async function findRequiredProvider(fsPath, identifier) {

    //console.log(requiredProvidersAtPath)
    identifier = identifier.split('_')[0]
    const segements = fsPath.split('\\')

    const targetProvider = {
        version: null,
        source: null
    }

    while (segements.length > 0) {
        const parentPath = segements.join('\\')
        if (parentPath in Settings.requiredProvidersAtPath) {

            const requiredProviders = Settings.requiredProvidersAtPath[parentPath]
            if (identifier in requiredProviders) {
                targetProvider.source = requiredProviders[identifier].source ?? targetProvider.source
                targetProvider.version = requiredProviders[identifier].version ?? targetProvider.version
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
    findRequiredProvider
}