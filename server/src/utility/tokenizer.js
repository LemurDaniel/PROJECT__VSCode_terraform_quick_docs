class Node {

    constructor(type, value) {
        this.type = type
        this.value = value
    }

}

class Tokenizer {

    static Default = [
        ['WHITESPACE', /^\s+/],
        ['COMMENT', /^#[^\n]+|^\/\*[\s\S]*?\*\//],
        ['IGNORE', /^;/],
        ['SEPERATOR', /^\n+|^;+/],
        ['BLOCK_END', /^}/],
        ['BLOCK_START', /^{/],
        ['ARRAY_END', /^\]/],
        ['ARRAY_START', /^\[/],
        ['ARRAY_SEPERATOR', /^,/],
        //['HEREDOC_STRING', /^<<-{0,1}(\w+)\s*\n((?,[\s\S])*?)\s*\n\s*\1[\s\n]{0,1}/],
        ['MODULE', /^module/],
        ['VARIABLE', /^(?!false\b.*\n|true\b.*\n|null\b.*\n)[A-Za-z_]{1}[\w_\-]*\s+/],
        ['STRING', /^\"[^ \"]*\"|^'[^']*'/],
        ['BOOLEAN', /^true|^false/],
        ['NULL', /^null/],
        ['FLOAT', /^[+-]?\d+\.\d+/],
        ['NUMBER', /^[+-]?\d+/],
        ['ASSIGNMENT', /^=/]
    ]

    #content
    #current
    #configuration
    constructor(configuration = Tokenizer.Default) {
        this.#configuration = configuration
        this.#content = null
    }

    set content(value) {
        this.#content = value
        this.#current = this.next()
    }

    get content() {
        return this.#content
    }

    get hasNext() {
        return this.#content != null && this.#content.length > 0
    }

    get current() {
        return this.#current
    }

    next() {

        if (!this.hasNext) {
            this.#current = null
            return this.#current
        }

        for (const [type, regex, skip] of this.#configuration) {

            const match = this.#content.match(regex)
            if (!match) continue

            this.#content = this.#content.substring(match[0].length)
            if (skip) return this.next()

            this.#current = new Node(type, match[0])
            return this.#current
        }

        throw new Error(`Unexpected Token '${this.#content[0]}'`)
    }


}


module.exports = {
    Tokenizer,
    Node
}