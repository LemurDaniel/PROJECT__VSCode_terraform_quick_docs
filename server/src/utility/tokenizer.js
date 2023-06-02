class Node {

    constructor(type, value) {
        this.type = type
        this.value = value
    }

}

class Tokenizer {

    static Default = []

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