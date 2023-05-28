
const { Tokenizer, Node } = require('./tokenizer')


module.exports = class BlockAnalyzer {

    #tokenizer
    #currentLine
    #currentPath
    constructor(configuration) {
        this.#currentLine = 0
        this.#currentPath = []
        this.#tokenizer = new Tokenizer(configuration ?? [
            ['LINEBREAK', /^\r\n|^\n/, false],
            ['WHITESPACE', /^\s+/, true],
            ['BRACKET_START', /^{/, false],
            ['BRACKET_END', /^}/, false],

            ['RESOURCE_BLOCK', /^resource\s*"[a-z0-9_]+"\s*"[a-z0-9_]+"/i, false],
            ['DATA_BLOCK', /^data\s*"[a-z0-9_]+"\s*"[a-z0-9_]+"/i, false],
            ['DYNAMIC_BLOCK', /^dynamic\s*"[a-z0-9_]+"/i, false],

            ['IDENTIFIER', /^(?!false\b.*\n|true\b.*\n|null\b.*\n)[A-Za-z_]{1}[\w_\-]*\s+/i, false],
            ['ASSIGNMENT', /^=/, false],

            ['STRING', /^"[^"]*"|^'[^']*'/, false],
            ['BOOLEAN', /^true|^false/, false],
            ['NULL', /^null/, false],
            ['FLOAT', /^[+-]?\d+\.\d+/, false],
            ['NUMBER', /^[+-]?\d+/, false],

            ['IGNORE', /^[\S]/, true]
        ])
    }

    analyze(content) {

        this.#tokenizer.content = content
        this.#currentPath = []
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
                const node = new Node('blockDefinition', {
                    range: {
                        linestart: this.#currentLine,
                        lineend: null
                    },
                    attributes: {},
                    blockDefinitions: []
                })

                this.definitionList('BRACKET_END').forEach(member => {
                    if (member.type == 'AttributeAssignment')
                        node.value.attributes[member.value.identifier] = member.value.value
                    else if (member.type == 'DynamicDefinition')
                        node.value.blockDefinitions.push(member)
                    else if (member.type == 'AttributeBlockDefinition')
                        node.value.blockDefinitions.push(member)
                    else
                        null //throw Error(member.type)
                })

                node.value.range.lineend = this.#currentLine
                if (node.value.blockDefinitions.length == 0)
                    delete node.value.blockDefinitions

                this.#eat('BRACKET_END')
                return node
            }

            case 'IDENTIFIER': {
                const name = this.#eat('IDENTIFIER').value.trim()
                if (this.#tokenizer.current.type == 'ASSIGNMENT') {
                    this.#eat('ASSIGNMENT')
                    return new Node('AttributeAssignment', {
                        identifier: name,
                        value: this.definition()?.value
                    })
                }

                else if (this.#tokenizer.current.type == 'BRACKET_START') {
                    return this.blockDefinition('AttributeBlockDefinition', name)
                }

                return null
            }

            case 'NUMBER':
            case 'BOOLEAN':
            case 'NULL':
            case 'FLOAT': {
                return new Node('Literal', new Node(
                    this.#tokenizer.current.type,
                    this.#eat(this.#tokenizer.current.type).value
                ))
            }
            case 'STRING': {
                const value =  this.#eat(this.#tokenizer.current.type).value
                return new Node('Literal', new Node(
                    'STRING',
                    value.substr(1, value.length-2)
                ))
            }

            default: {
                this.#eat(this.#tokenizer.current.type)
                return null
            }
        }

        return null
    }

    blockDefinition(name, resourceIdentifier, resourceName) {

        this.#currentPath.push(resourceIdentifier)
        const node = new Node(name, {
            ...this.definition().value,
            name: resourceName,
            identifier: resourceIdentifier,
            fullPath: this.#currentPath.join('.').split('.')
        })
        this.#currentPath.pop()

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