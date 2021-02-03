// Return the first not null-like value.
const { coalesce } = require('extant')

// Proxied header constructor.
const Header = require('./header')

// An evented message queue.
const { Queue } = require('avenue')

// Send a Node.js HTTP stream over a Conduit event stream.
const Sender = require('./sender')

// Convert a Conduit event stream into an HTTP write.
const Consumer = require('./consumer')

// Create a new request that proxies the given Node.js HTTP request and response
// through the given Conduit client. An optional rewrite function can be used to
// amend the HTTP headers before the request is proxied.

//
class Requester {
    constructor (destructible, conduit, rewrite) {
        this._conduit = conduit
        this._rewrite = coalesce(rewrite, () => {})
        this._instance = 1
        this._destructible = destructible
    }

    // http://stackoverflow.com/a/5426648
    request (request, response) {
        const instance = ++this._instance
        const destructible = this._destructible.ephemeral(`request.${instance}`)
        destructible.ephemeral('header', async () => {
            const receiver = { outbox: new Queue, inbox: new Queue }
            const header = new Header(request)
            this._rewrite.call(null, header)
            const { shifter, queue } = await this._conduit.queue({
                module: 'conduit/requester',
                method: 'header',
                body: header.toJSON(),
                inbox: true,
                outbox: true
            })
            const consumer = new Consumer(response, 'conduit/middleware')
            destructible.ephemeral('shifter', shifter.push(consumer.enqueue.bind(consumer)))
            destructible.durable('queue', async () => {
                await Sender(request, queue, 'conduit/requester')
                destructible.destroy()
            })
        })
    }
}

module.exports = Requester
