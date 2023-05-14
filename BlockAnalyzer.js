
const { Tokenizer, Node } = require('./tokenizer')


class BlockAnalyzer {

    #tokenizer
    #currentLine
    constructor(content) {
        this.#currentLine = 0
        this.#tokenizer = new Tokenizer([
            ['LINEBREAK', /^\r\n|^\n/, false],
            ['WHITESPACE', /^\s+/, true],
            ['BRACKET_START', /^{/, false],
            ['BRACKET_END', /^}/, false],
            ['RESOURCE_BLOCK', /^resource\s*"[a-z0-9_]+"\s*"[a-z0-9_]+"/i, false],
            ['DATA_BLOCK', /^data\s*"[a-z0-9_]+"\s*"[a-z0-9_]+"/i, false],
            ['DYNAMIC_BLOCK', /^dynamic\s*"[a-z0-9_]+"/i, false],
            ['IGNORE', /^[\S]/, true]
        ])
    }

    analyze(configuration) {

        this.#tokenizer.content = configuration
        this.#currentLine = 1

        return {
            filename: "",
            definitions: this.definitionList()
        }
    }

    definitionList(stopLookahead = null) {

        const definitions = []
        while (null != this.#tokenizer.current && this.#tokenizer.current.type != stopLookahead) {

            console.log(this.#tokenizer.current.type, stopLookahead, this.#currentLine)
            const definition = this.definition()
            if (null != definition) {
                definitions.push(definition)
            }
        }

        return definitions
    }

    definition() {

        switch (this.#tokenizer.current.type) {

            case 'LINEBREAK': {
                this.#currentLine++
                this.#eat('LINEBREAK')
                return null
            }

            case 'DATA_BLOCK': {
                const blockDefinition = this.#eat(this.#tokenizer.current.type).value
                const resourceIdentifier = blockDefinition.match(/"[a-z0-9_]+"/gi)[0].replaceAll('"', '')
                const resourceName = blockDefinition.match(/"[a-z0-9_]+"/gi)[1].replaceAll('"', '')
                return this.blockDefinition('DataSourceDefinition', resourceIdentifier, resourceName)
            }
            case 'RESOURCE_BLOCK': {
                const blockDefinition = this.#eat(this.#tokenizer.current.type).value
                const resourceIdentifier = blockDefinition.match(/"[a-z0-9_]+"/gi)[0].replaceAll('"', '')
                const resourceName = blockDefinition.match(/"[a-z0-9_]+"/gi)[1].replaceAll('"', '')
                return this.blockDefinition('ResourceDefinition', resourceIdentifier, resourceName)
            }

            case 'DYNAMIC_BLOCK': {
                const blockDefinition = this.#eat(this.#tokenizer.current.type).value
                const resourceIdentifier = blockDefinition.match(/"[a-z0-9_]+"/gi)[0].replaceAll('"', '')
                return this.blockDefinition('DynamicDefinition', resourceIdentifier, null)
            }

            case 'BRACKET_START': {
                this.#eat('BRACKET_START')
                const definitions = this.definitionList('BRACKET_END')
                this.#eat('BRACKET_END')
                return definitions.length > 0 ? definitions : null
            }
        }

        return null
    }

    blockDefinition(name, resourceIdentifier, resourceName) {

        this.#eat('BRACKET_START')
        const node = new Node(name, {
            name: resourceName,
            identifier: resourceIdentifier,
            range: {
                linestart: this.#currentLine,
                lineend: null
            },
            block: this.definitionList('BRACKET_END')
        })
        this.#eat('BRACKET_END')

        node.value.range.lineend = this.#currentLine
        return node
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


const file = './test_configuration2.tf'
const content = require('fs').readFileSync(file, 'utf-8')

const analyzer = new BlockAnalyzer()
const output = analyzer.analyze(content)

require('fs').writeFileSync(file.replace('.tf', '.out.json'), JSON.stringify(output))