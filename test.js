
const { Tokenizer, Node } = require('./tokenizer')


class DocsAnalyzer {

    #tokenizer
    constructor(content) {
        this.#tokenizer = new Tokenizer([
            ['WHITESPACE', /^\s+/, true],
            ['NOTES', /^->\s*\*+Note:\*+[^\n\r]+/, false],
            ['PARAMETER', /^\s*`[A-Za-z_]+`\s*[-:]\s*[^\r\n|\n]+/, false],
            ['BLOCK', /^[`A-Za-z_\s]+ block supports the following:/, false],
            ['LIST_SEGMENT', /^[-\*]/, false],
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
        return {
            category: docsAttributes.category,
            subcategory: docsAttributes.subcategory,
            slug: docsAttributes.slug,
            title: docsAttributes.title,
            definitions: this.cleanup(this.definitionList())
        }
    }

    cleanup(definitions) {

        const references = {}
        const cleaned = []

        for (const entry of definitions) {

            if (entry.type == 'ParameterDefinition') {
                cleaned.push(entry)
                references[entry.value.name] = entry.value
            }

            else if (entry.type == 'ParameterBlock') {
                if (entry.value.referencePath[0] in references)
                    references[entry.value.referencePath[0]].value = entry

                else
                    console.log(`Unmatched => ${entry.value.referencePath}`)
            }
        }


        return cleaned
    }

    definitionList(stopLookahead = null) {

        const definitions = []
        while (null != this.#tokenizer.current && this.#tokenizer.current.type != stopLookahead) {
            console.log(this.#tokenizer.current.type)
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
                    description: description.substring(12),
                    required: description.toLowerCase().includes('(required)')
                })
            }

            case 'BLOCK': {
                const current = this.#eat('BLOCK').value
                const notes = this.#tokenizer.current.type == 'NOTES' ? this.#eat('NOTES').value : null
                return new Node('ParameterBlock', {
                    notes: notes,
                    referencePath: current.match(/`[A-Za-z0-9_]+`/g).map(v => v.replaceAll('`', '')),
                    parameters: this.definitionList('BLOCK')
                })
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