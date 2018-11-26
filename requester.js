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
    this._conduit = vargs.shift()
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
    var _request = this._conduit.connect({
        module: 'conduit/requester',
        method: 'header',
        body: header,
        inbox: true,
        outbox: true
    })
    var consumer = new Consumer(response, 'conduit/middleware')
    _request.inbox.pump(consumer, 'enqueue').run(destructible.monitor('consumer'))
    Sender(request, _request.outbox, 'conduit/requester', async())
})

module.exports = cadence(function (async, destructible) {
    var vargs = []
    vargs.push.apply(vargs, arguments)
    vargs.splice(0, 2)
    return new Requester(destructible, vargs)
})
