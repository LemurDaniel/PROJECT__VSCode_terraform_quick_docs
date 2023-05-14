
const { Tokenizer, Node } = require('./tokenizer')


class DocsAnalyzer {

    #tokenizer
    constructor(content) {
        this.#tokenizer = new Tokenizer([
            ['WHITESPACE', /^\s+/, true],
            ['LIST_SEGMENT', /^[-\*]/, false],
            ['PARAMETER', /^\s*`[A-Za-z_]+`\s*-\s*[^\r\n|\n]+/, false],
            ['BLOCK', /^`[A-Za-z_]+` block supports the following:/, false],
            ['IGNORE', /^[^\n\r]+/, true]
        ])
    }

    analyze(docsAttributes) {

        const argumentReference = docsAttributes.content
            .substring(
                docsAttributes.content.indexOf('## Argument Reference'),
                docsAttributes.content.indexOf('## Attributes Reference')
            ).split('\\n').join('\n')

        this.#tokenizer.content = argumentReference
        const documentation = {
            category: docsAttributes.category,
            subcategory: docsAttributes.subcategory,
            slug: docsAttributes.slug,
            title: docsAttributes.title,
            definitions: []
        }

        console.log(argumentReference)
        while (null != this.#tokenizer.current) {
            const definition = this.definition()
            if (null != definition) {
                documentation.definitions.push(definition)
            }
        }

        return documentation
    }

    definition() {

        console.log(this.#tokenizer.current.type)
        if (this.#tokenizer.current.type == 'LIST_SEGMENT')
            this.#eat('LIST_SEGMENT')

        switch (this.#tokenizer.current.type) {

            case 'PARAMETER': {
                const current = this.#eat('PARAMETER').value
                const identifier = current.match(/`[A-Za-z0-9_]+`/)[0].replaceAll('`', '')
                const description = current.split('-')[1]

                return new Node('ParameterDefinition', {
                    name: identifier,
                    description: description.substring(12),
                    required: description.toLowerCase().includes('(required)')
                })
            }

            case 'BLOCK': {
                this.#eat('BLOCK')
                return null
            }
        }

        this.#eat()
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




const file = './sample-full-01.json'
const docsJson = require('fs').readFileSync(file, 'utf-8')

const analyzer = new DocsAnalyzer()
const output = analyzer.analyze(JSON.parse(docsJson).data.attributes)

require('fs').writeFileSync(file.replace('.json', '.out.json'), JSON.stringify(output))