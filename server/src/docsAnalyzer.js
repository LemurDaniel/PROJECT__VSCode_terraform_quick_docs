
const { Tokenizer, Node } = require('./tokenizer')


module.exports = class DocsAnalyzer {

    #tokenizer
    constructor() {
        this.#tokenizer = new Tokenizer([
            ['WHITESPACE', /^\s+/, true],
            ['NOTE', /^->[^\n\r]+/, false],
            ['WARNING', /^!>[^\n\r]+/, false],
            ['ISSUE', /^~>[^\n\r]+/, false],
            ['PARAMETER', /^\s*`[a-z_]+`\s*[-:]\s*[^\r\n|\n]+/i, false],
            ['BLOCK', /^[`a-z_\s]+ block supports the following:/i, false],
            ['LIST_SEGMENT', /^[-\*]/, false],
            ['IGNORE', /^\S/, true]
        ])
    }

    analyze(docsAttributes) {

        const argumentsIndex = docsAttributes.content.match(/argument[s]*\s*reference/i).index + "arguments reference".length
        const attributesIndex = docsAttributes.content.match(/attribute[s]*\s*reference/i).index - "attributes reference".length

        this.#tokenizer.content = docsAttributes.content.substring(argumentsIndex, attributesIndex).split('\\n').join('\n')

        return {
            category: docsAttributes.category,
            subcategory: docsAttributes.subcategory,
            slug: docsAttributes.slug,
            title: docsAttributes.title,
            definitions: this.#cleanup(this.definitionList())
        }
    }

    #cleanup(definitions) {

        const parameterBlocks = []
        const parameterDefinitions = []
        const references = {}

        this.#sortTypes(definitions, parameterBlocks, parameterDefinitions, references)

        const unmatched = []
        for (const block of parameterBlocks) {
            const fullReferencePath = block.value.referencePath.join('.')
            if (fullReferencePath in references)
                references[fullReferencePath].block = block
            //else if (block.value.referencePath[0] in references)
            //    references[block.value.referencePath[0]].block = block
            else
                unmatched.push(block)
        }

        if (unmatched.length > 0) {
            console.log('Unmatched Blocks: ')
            unmatched.forEach(b => console.log(`    ${b.value.referencePath}`))
        }

        return parameterDefinitions
    }

    #sortTypes(definitions, parameterBlocks, parameterDefinitions, references, currentPath = []) {

        for (const entry of definitions) {

            if (entry.type == 'ParameterDefinition') {
                parameterDefinitions.push(entry)

                if (currentPath.length > 0) {
                    const fullReferencePath = [...currentPath, entry.value.name].join('.')
                    references[fullReferencePath] = entry.value
                }

                if (!(entry.value.name in references))
                    references[entry.value.name] = entry.value
            }

            else if (entry.type == 'ParameterBlock') {
                parameterBlocks.push(entry)
                this.#sortTypes(
                    entry.value.parameters,
                    parameterBlocks,
                    parameterDefinitions,
                    references,
                    currentPath.concat(entry.value.referencePath)
                )
            }
        }

    }

    definitionList(stopLookahead = null) {

        const definitions = []
        while (null != this.#tokenizer.current && this.#tokenizer.current.type != stopLookahead) {
            //console.log(this.#tokenizer.current.type, this.#tokenizer.current.value)
            const definition = this.definition()
            if (null != definition) {
                definitions.push(definition)
            }
        }

        return definitions
    }

    definition() {

        switch (this.#tokenizer.current.type) {

            case 'LIST_SEGMENT': {
                this.#eat('LIST_SEGMENT')
                if (this.#tokenizer.current.type == 'BLOCK') return null
                else return this.definition()
            }

            case 'PARAMETER': {
                const current = this.#eat('PARAMETER').value
                const identifier = current.match(/`[A-Za-z0-9_]+`/)[0].replaceAll('`', '')
                const description = current.split(/[-:]/)[1].trim()

                return new Node('ParameterDefinition', {
                    name: identifier,
                    note: this.#tokenizer.current?.type == 'NOTE' ? this.#eat('NOTE').value : null,
                    issue: this.#tokenizer.current?.type == 'ISSUE' ? this.#eat('ISSUE').value : null,
                    warning: this.#tokenizer.current?.type == 'WARNING' ? this.#eat('WARNING').value : null,
                    description: description.replace(/\(required\)|\(optional\)/i, '').trim(),
                    required: description.toLowerCase().includes('(required)')
                })
            }

            case 'BLOCK': {
                const current = this.#eat('BLOCK').value

                return new Node('ParameterBlock', {
                    note: this.#tokenizer.current?.type == 'NOTE' ? this.#eat('NOTE').value : null,
                    issue: this.#tokenizer.current?.type == 'ISSUE' ? this.#eat('ISSUE').value : null,
                    warning: this.#tokenizer.current?.type == 'WARNING' ? this.#eat('WARNING').value : null,
                    referencePath: current.match(/`[A-Za-z0-9_]+`/g).map(v => v.replaceAll('`', '')),
                    parameters: this.definitionList('BLOCK')
                })
            }

            default: {
                if (this.#tokenizer.current) this.#eat(this.#tokenizer.current.type)
            }
        }

        return null
    }

    #eat(tokenType) {

        const current = this.#tokenizer.current

        if (null == current) {
            throw `unexpected EOF, expected: '${tokenType}'`
        }

        if (null != tokenType && current.type != tokenType) {
            throw `unexpected token: '${this.#tokenizer.current.type}', expected '${tokenType}'; ${this.#tokenizer.current.value}`
        }

        this.#tokenizer.next()

        return current
    }
}