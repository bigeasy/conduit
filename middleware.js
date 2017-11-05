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

function Middleware () {
    var vargs = Array.prototype.slice.call(arguments)
    var timeout = Timeout(15000, vargs)
    var server = vargs.shift()
    var middleware = vargs.shift()
    this._interlocutor = new Interlocutor(middleware)
    this._destructible = new Destructible(timeout, 'conduit/middleware')
    this._destructible.markDestroyed(this, 'destroyed')
    this._instance = 0
}

Middleware.prototype.socket = function (envelope) {
    var receiver = { read: new Procession, write: new Procession }
    var request = this._interlocutor.request({
        httpVersion: envelope.body.httpVersion,
        method: envelope.body.method,
        path: envelope.body.url,
        headers: envelope.body.headers,
        rawHeaders: envelope.body.rawHeaders
    })
    this._respond(request, receiver.read, this._destructible.rescue([ 'request', 'send', this._instance++ ]))
    var consumer = new Consumer(request, 'conduit/requester')
    receiver.write.shifter().pump(consumer, 'enqueue')
    return receiver
}

Middleware.prototype._respond = cadence(function (async, request, read) {
    async(function () {
        delta(async()).ee(request).on('response')
    }, function (response) {
        async(function () {
            read.enqueue({
                module: 'conduit/middleware',
                method: 'header',
                body: {
                    statusCode: response.statusCode,
                    statusMessage: response.statusMessage,
                    headers: response.headers
                }
            }, async())
        }, function () {
            Sender(response, read, 'conduit/middleware', async())
        })
    })
})

Middleware.prototype.listen = function (callback) {
    this._destructible.completed.wait(callback)
}

Middleware.prototype.destroy = function () {
    this._destructible.destroy()
}

module.exports = Middleware
