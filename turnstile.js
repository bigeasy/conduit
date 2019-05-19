class Turnstile {
    constructor () {
        this.queue = new Queue({ turnstile: true })
        this._destructible = new Destructible('responder')
        for (var i = 0; i < turnstiles; i++) {
            this._destructible.durable([ 'turnstile', i ], this.read())
        }
        this._destructible.destruct(() => this.queue.push(null))
        this.promise = this._destructible.promise
    }

    async read () {
        const responder = this._responder
        for (;;) {
            const request = await this.queue.shift()
            if (request == null) {
                break
            }
            if (request.entry.shifter || request.entry.queue) {
                await responder(request.header, request.shifter, request.queue)
            } else {
                await header.queue.enqueue([ await responder(request.header, null, null), null ])
            }
        }
    }

    destroy () {
        this._destructible.destroy()
    }

    respond(request) {
        this.queue.push({ responder, request })
    }
}

module.exports = Turnstile
