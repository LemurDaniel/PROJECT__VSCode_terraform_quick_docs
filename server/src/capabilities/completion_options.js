

const {
    CompletionItemKind,
} = require('vscode-languageserver/node')

const Registry = require('../utility/registry')
const BlockAnalyzer = require('../utility/blockAnalyzer')
const DocsAnalyzer = require('../utility/docsAnalyzer')

///////////////////////////////////////////////////////////////////////////////////////////////////////
////// File opens, changes
//////////////////////////////////////////////////////////////////////////////////////////////////////

const docsAnalyzer = new DocsAnalyzer()
const blockAnalyzer = new BlockAnalyzer()
const tfConfigParseCache = {}
const tfDocsAnalyzeCache = {}

function analyzeFile(document) {

    if (document._uri in tfConfigParseCache) {
        const { content, changed, lastParse } = tfConfigParseCache[document._uri]
        if (!changed) return content
    }

    tfConfigParseCache[document._uri] = {
        lastParse: Date.now(),
        content: blockAnalyzer.analyze(document.getText()),
        changed: false
    }

    // Call and already cache elements
    //tfConfigParseCache[document._uri].content.forEach(
    //    definitionBlock => completionMetaForBlock(definitionBlock)
    //)

    return tfConfigParseCache[document._uri].content
}


function documentsOnDidChangeContent({ document }) {

    if (document._uri in tfConfigParseCache) {
        tfConfigParseCache[document._uri].changed = true
    }

}

function documentsOnDidOpen({ document }) {

    if (!initDone) return

    let matches = document._content.match(/resource\s*"[A-Za-z0-9_]+"|data\s*"[A-Za-z0-9_]+"/g)
    if (null == matches) return

    matches = matches.map(line => line.match(/"[A-Za-z0-9_]+"/)[0].replace(/"+/g, ''))
        .map(line => line.split('_').at(0))
        .reduce((acc, value) => ({
            ...acc,
            [value]: value
        }), {})
    if (null == matches) return

    Object.keys(matches).forEach(resourceIdentifier =>
        Registry.instance.findProviderInfo(resourceIdentifier, connection)
            .catch(error => console.log(error.message))
    )

    analyzeFile(document)
}


///////////////////////////////////////////////////////////////////////////////////////////////////////
////// Autcompletion
//////////////////////////////////////////////////////////////////////////////////////////////////////

async function completionMetaForBlock(blockDefinition) {

    if (null == blockDefinition) return

    let resourceInfo = null
    const identifier = blockDefinition.value.identifier

    if (blockDefinition.type == 'ResourceDefinition')
        resourceInfo = await Registry.instance.findProviderResource(identifier, Registry.TYPES['resource']).then(info => info?.resourceInfo)
    else if (blockDefinition.type == 'DataSourceDefinition')
        resourceInfo = await Registry.instance.findProviderResource(identifier, Registry.TYPES['data']).then(info => info?.resourceInfo)

    if (null == resourceInfo) return null
    if (resourceInfo.id in tfDocsAnalyzeCache)
        return tfDocsAnalyzeCache[resourceInfo.id]

    resourceDocumentation = await Registry.instance.getResourceDocs(resourceInfo)
    if (null == resourceDocumentation) return null

    try {
        tfDocsAnalyzeCache[resourceInfo.id] = docsAnalyzer.analyze(resourceDocumentation.data.attributes)
        return tfDocsAnalyzeCache[resourceInfo.id]
    } catch (exception) {
        console.log(exception.message)
        return null
    }

}

function findSubBlock(definitionBlock, position) {

    for (const blockDefinition of definitionBlock.value.blockDefinitions) {

        if (position.line < blockDefinition.value.range.linestart) continue
        if (position.line > blockDefinition.value.range.lineend) continue

        return findSubBlock(blockDefinition, position)

    }

    return definitionBlock
}

async function getCompletionOptions(document, position) {

    // Find block of cursor position
    let currentMainBlock = null
    let currentSubBlock = null
    for (const definitionBlock of analyzeFile(document)) {

        const range = definitionBlock.value.range
        if (position.line <= range.linestart) continue
        if (position.line >= range.lineend) continue
        currentMainBlock = definitionBlock
        break

    }

    currentSubBlock = findSubBlock(currentMainBlock, position)
    const currentPath = currentSubBlock.value.fullPath.filter(v => v != 'content').map(v => v)

    console.log('-----------------------------------------------------')
    console.log(`Currently in Block: ${currentMainBlock.value.identifier}`)
    console.log(`Currently in Block: ${JSON.stringify(currentSubBlock.value.range)}`)



    // Parse Documentation Parameterdefinitions
    const completionMeta = await completionMetaForBlock(currentMainBlock)
    if (null == completionMeta) return null

    let parameterDefinition = completionMeta
    while (currentPath.length > 1) {
        const currentSegment = currentPath.pop()
        parameterDefinition = parameterDefinition.value.parameters.filter(v => v.value.name == currentSegment)
        if (parameterDefinition.length == 0) return null

        parameterDefinition = parameterDefinition.at(0).value.block
    }

    // Filter down to completionoptions
    if (null == parameterDefinition) return null
    const completionOptions = parameterDefinition.value.parameters.map(
        ({ value }) => ({
            label: value.name,
            kind: CompletionItemKind.Property,
            detail: value.fullDescription,
            documentation: [
                value.issue,
                value.warning,
                value.note
            ].filter(v => null != v).at(0),
            data: {
                isAttribute: !('block' in value),
                isBlock: ('block' in value),
                ...value
            }
        })
    ).filter(completionOption =>
        completionOption.data.isBlock || !(completionOption.label in currentSubBlock.value.attributes)
    )

    console.log(JSON.stringify(completionOptions.map(v => v.label)))
    console.log('-----------------------------------------------------')
    return completionOptions
}


module.exports = {
    documentsOnDidChangeContent,
    documentsOnDidOpen,
    getCompletionOptions
}