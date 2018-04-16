// Asynchronous control flow.
var cadence = require('cadence')
var delta = require('delta')

// Read and write streams with error-first callbacks.
var Staccato = require('staccato')

// An evented work queue.
var Procession = require('procession')

// Container for Sencha Connect middleware.
var Interlocutor = require('interlocutor')

// Send a Node.js HTTP stream over a Conduit event stream.
var Sender = require('./sender')

// Convert a Conduit event stream into an HTTP write.
var Consumer = require('./consumer')

// Controlled demolition of asynchronous operations.
var Destructible = require('destructible')

// Pluck a shutdown timeout if it is the first argument to a constructor.
var Timeout = require('./timeout')

function Middleware (destructible, vargs) {
    destructible.destruct.wait(destructible.monitor('terminator'))
    var timeout = Timeout(15000, vargs)
    var middleware = vargs.shift()
    this._interlocutor = new Interlocutor(middleware)
    this._instance = 0
    this._destructible = destructible
}

// TODO Implement rescue as a method that takes an argument the way you've
// implemented `monitor`. Ensure that you manage to somehow remove the rescue
// from the waiting callbacks. (Of course you do.) Maybe the response is a
// separate object.
Middleware.prototype.socket = cadence(function (async, envelope) {
    var receiver = { outbox: new Procession, inbox: new Procession }
    async(function () {
        this._destructible.monitor([ 'request', this._instance++ ], true, this, '_respond', envelope, receiver, async())
    }, function () {
        return receiver
    })
})

Middleware.prototype._respond = cadence(function (async, destructible, envelope, receiver) {
    var request = this._interlocutor.request({
        httpVersion: envelope.body.httpVersion,
        method: envelope.body.method,
        path: envelope.body.url,
        headers: envelope.body.headers,
        rawHeaders: envelope.body.rawHeaders
    })
    var consumer = new Consumer(request, 'conduit/requester')
    receiver.inbox.shifter().pump(consumer, 'enqueue', destructible.monitor('consumer'))
    this._request(receiver, request, destructible.monitor('request'))
})

Middleware.prototype._request = cadence(function (async, receiver, request) {
    async(function () {
        delta(async()).ee(request).on('response')
    }, function (response) {
        async(function () {
            receiver.outbox.enqueue({
                module: 'conduit/middleware',
                method: 'header',
                body: {
                    statusCode: response.statusCode,
                    statusMessage: response.statusMessage,
                    headers: response.headers
                }
            }, async())
        }, function () {
            Sender(response, receiver.outbox, 'conduit/middleware', async())
        })
    })
})

module.exports = cadence(function (async, destructible) {
    return new Middleware(destructible, Array.prototype.slice.call(arguments, 2))
})
