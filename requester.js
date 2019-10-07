// Return the first not null-like value.
var coalesce = require('extant')

// Proxied header constructor.
var Header = require('./header')

// An evented message queue.
var Queue = require('avenue')

// Send a Node.js HTTP stream over a Conduit event stream.
var Sender = require('./sender')

// Convert a Conduit event stream into an HTTP write.
var Consumer = require('./consumer')

// Create a new request that proxies the given Node.js HTTP request and response
// through the given Conduit client. An optional rewrite function can be used to
// amend the HTTP headers before the request is proxied.

//
class Requester {
    constructor (destructible, conduit, rewrite) {
        this._conduit = conduit
        this._rewrite = coalesce(rewrite, () => {})
        this._instance = '0'
        this._destructible = destructible
    }

    // http://stackoverflow.com/a/5426648
    request (request, response) {
        const instance = this._instance = String(BigInt(this._instance) + 1n)
        const destructible = this._destructible.ephemeral([ 'request', instance ])
        const receiver = { outbox: new Queue, inbox: new Queue }
        const header = new Header(request)
        this._rewrite.call(null, header)
        const { shifter, queue } = this._conduit.queue({
            module: 'conduit/requester',
            method: 'header',
            body: header,
            inbox: true,
            outbox: true
        })
        const consumer = new Consumer(response, 'conduit/middleware')
        destructible.durable('shifter', shifter.pump(consumer.enqueue.bind(consumer)))
        destructible.durable('queue', Sender(request, queue, 'conduit/requester'))
    }
}

module.exports = Requester
