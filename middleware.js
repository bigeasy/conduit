// Asynchronous control flow.
// An `async`/`await` work queue.
var Queue = require('avenue')
const once = require('prospective/once')

// Container for Sencha Connect middleware.
var Interlocutor = require('interlocutor')

// Send a Node.js HTTP stream over a Conduit event stream.
var Sender = require('./sender')

// Convert a Conduit event stream into an HTTP write.
var Consumer = require('./consumer')

// Controlled demolition of asynchronous operations.
var Destructible = require('destructible')

class Middleware {
    constructor (destructible, ...vargs) {
        this._interlocutor = new Interlocutor(vargs.shift())
        this._instance = '0'
        this._destructible = destructible
    }

    // TODO Implement rescue as a method that takes an argument the way you've
    // implemented `monitor`. Ensure that you manage to somehow remove the
    // rescue from the waiting callbacks. (Of course you do.) Maybe the response
    // is a separate object.
    request (header, shifter, queue) {
        const destructible = this._destructible.ephemeral([
            'request', this._instance = String(BigInt(this._instance) + 1n)
        ])
        const request = this._interlocutor.request({
            httpVersion: header.httpVersion,
            method: header.method,
            path: header.url,
            headers: header.headers,
            rawHeaders: header.rawHeaders
        })
        const consumer = new Consumer(request, 'conduit/requester')
        destructible.durable('shifter', shifter.pump(consumer.enqueue.bind(consumer)))
        destructible.durable('queue', this._request(queue, request))
    }

    async _request (queue, request) {
        const [ response ] = await once(request, 'response').promise
        await queue.push({
            module: 'conduit/middleware',
            method: 'header',
            body: {
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                headers: response.headers
            }
        })
        await Sender(response, queue, 'conduit/middleware')
    }
}

module.exports = Middleware
