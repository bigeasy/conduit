// Control-flow utilities.
var cadence = require('cadence')

// Read and write streams with error-first callbacks.
var Staccato = require('staccato')

// Return the first not null-like value.
var coalesce = require('extant')

// Proxied header constructor.
var Header = require('./header')

// An evented message queue.
var Procession = require('procession')

// Pluck a shutdown timeout if it is the first argument to a constructor.
var Timeout = require('./timeout')

// Send a Node.js HTTP stream over a Conduit event stream.
var Sender = require('./sender')

// Convert a Conduit event stream into an HTTP write.
var Consumer = require('./consumer')

var Operation = require('operation')

var abend = require('abend')

// Create a new request that proxies the given Node.js HTTP request and response
// through the given Conduit client. An optional rewrite function can be used to
// amend the HTTP headers before the request is proxied.

//
function Requester (destructible, vargs) {
    destructible.destruct.wait(destructible.monitor('terminator'))
    var timeout = Timeout(15000, vargs)
    this._client = vargs.shift()
    this._rewrite = Operation(vargs)
    this._instance = 0
    this._destructible = destructible
}

// http://stackoverflow.com/a/5426648
Requester.prototype.request = function (request, response) {
    this._destructible.monitor([ 'request', this._instance++ ], true, this, '_request', request, response, null)
}

Requester.prototype._request = cadence(function (async, destructible, request, response) {
    var receiver = { outbox: new Procession, inbox: new Procession }
    var header = new Header(request)
    this._rewrite.call(null, header)
    var receiver = { outbox: new Procession, inbox: new Procession }
    var consumer = new Consumer(response, 'conduit/middleware')
    receiver.inbox.pump(consumer, 'enqueue', destructible.monitor('consumer'))
    async(function () {
        this._client.connect(receiver, {
            module: 'conduit/requester',
            method: 'header',
            body: header
        }, async())
    }, function () {
        Sender(request, receiver.outbox, 'conduit/requester', async())
    })
})

module.exports = cadence(function (async, destructible) {
    return new Requester(destructible, Array.prototype.slice.call(arguments, 2))
})
