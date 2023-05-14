
const { Tokenizer, Node } = require('./tokenizer')


module.exports = class BlockAnalyzer {

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
            ['IDENTIFIER', /^[a-z0-9_]+/i, false],
            ['ASSIGNMENT', /^=/, false],
            ['IGNORE', /^[\S]/, true]
        ])
    }

    analyze(configuration) {

        this.#tokenizer.content = configuration
        this.#currentLine = 1

        return this.definitionList()
    }

    definitionList(stopLookahead = null) {

        const definitions = []
        while (null != this.#tokenizer.current && this.#tokenizer.current.type != stopLookahead) {
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
                this.definitionList('BRACKET_END')
                this.#eat('BRACKET_END')
                return null
            }

            case 'IDENTIFIER': {
                const name = this.#eat('IDENTIFIER').value
                if (this.#tokenizer.current.type == 'ASSIGNMENT') {
                    this.#eat('ASSIGNMENT')
                    return new Node('BlockAttribute', name)
                }
                else if (name == 'content' && this.#tokenizer.current.type == 'BRACKET_START') {
                    return this.blockDefinition('contentDefinition', 'content')
                }
                else
                    return null
            }

            case 'ASSIGNMENT': {
                this.#eat('ASSIGNMENT')
                return null
            }
        }

        return null
    }

    blockDefinition(name, resourceIdentifier, resourceName) {

        const node = new Node(name, {
            name: resourceName,
            identifier: resourceIdentifier,
            range: {
                linestart: this.#currentLine,
                lineend: null
            },
            attributes: {},
            dynamics: []
        })

        this.#eat('BRACKET_START')
        this.definitionList('BRACKET_END').forEach(member => {
            if (member.type == 'BlockAttribute')
                node.value.attributes[member.value] = member.type
            else if (member.type == 'DynamicDefinition')
                node.value.dynamics.push(member)
            else if(member.type == 'contentDefinition')
                node.value.attributes.content = member.value
            else
                throw Error(member.type)
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