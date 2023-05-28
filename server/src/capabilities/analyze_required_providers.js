const {
    Position,
    Range
} = require('vscode-languageserver/node')

const fs = require('fs')
const Registry = require('../utility/registry')
const BlockAnalyzer = require('../utility/blockAnalyzer')


function* readDirectory(fspath, recursive) {

    for (const filename of fs.readdirSync(fspath)) {

        const fullPath = `${fspath}\\${filename}`
        if (filename.includes('.')) {
            if (filename.split('.').at(-1) == 'tf')
                yield ({ parentpath: fspath, filepath: fullPath })
            else
                continue
        }

        const isDirectory = fs.statSync(fullPath).isDirectory()
        if (isDirectory && recursive) yield* readDirectory(fullPath, recursive)
    }

}

const requiredProvidersAtPath = {}

async function analyzeRequiredProviders(fsPath, recursive = true) {

    const blockAnalyzer = new BlockAnalyzer()


    for (const { parentpath, filepath } of readDirectory(fsPath, recursive)) {

        const fileContent = fs.readFileSync(filepath, 'utf-8')
        if (!fileContent.includes('required_providers')) continue
        const analyzed = blockAnalyzer.analyze(fileContent)


        const terraformBlock = analyzed.filter(block => block.type == 'AttributeBlockDefinition' && block.value.identifier == 'terraform').at(0)?.value
        if (!terraformBlock) continue


        const requiredProviders = terraformBlock.blockDefinitions
            .filter(block => block.type == 'AttributeBlockDefinition' && block.value.identifier == 'required_providers').at(0)?.value
        if (!requiredProviders) continue

        requiredProvidersAtPath[parentpath] = {}
        for (const [provider, value] of Object.entries(requiredProviders.attributes)) {
            if (!value.attributes?.source?.value) continue
            requiredProvidersAtPath[parentpath][provider] = {
                source: value.attributes?.source?.value,
                version: value.attributes?.version?.value
            }

            Registry.instance.getProviderInfo(
                requiredProvidersAtPath[parentpath][provider].source,
                requiredProvidersAtPath[parentpath][provider].version
            )
        }

    }

    return

}



function findRequiredProvider(fsPath, identifier) {

    //console.log(requiredProvidersAtPath)
    identifier = identifier.split('_')[0]
    const segements = fsPath.split('\\')

    const targetProvider = {
        version: null,
        source: null
    }

    while (segements.length > 0) {
        const parentPath = segements.join('\\')
        if (parentPath in requiredProvidersAtPath) {

            const requiredProviders = requiredProvidersAtPath[parentPath]
            if (identifier in requiredProviders) {
                targetProvider.source = targetProvider.source ?? requiredProviders[identifier].source
                targetProvider.version = targetProvider.version ?? requiredProviders[identifier].version
            }

            if (targetProvider.version != null && targetProvider.source != null)
                return targetProvider
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