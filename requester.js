// Control-flow utilities.
var cadence = require('cadence')

// Read and write streams with error-first callbacks.
var Staccato = require('staccato')

// Return the first not null-like value.
var coalesce = require('extant')

// Do nothing.
var nop = require('nop')

// Proxied header constructor.
var Header = require('./header')

// An evented message queue.
var Procession = require('procession')

// Controlled demolition of asynchronous operations.
var Destructible = require('destructible')

// Pluck a shutdown timeout if it is the first argument to a constructor.
var Timeout = require('./timeout')

// Send a Node.js HTTP stream over a Conduit event stream.
var Sender = require('./sender')

// Convert a Conduit event stream into an HTTP write.
var Consumer = require('./consumer')

// Create a new request that proxies the given Node.js HTTP request and response
// through the given Conduit client. An optional rewrite function can be used to
// amend the HTTP headers before the request is proxied.

//
function Request () {
    var vargs = Array.prototype.slice.call(arguments)
    var timeout = Timeout(15000, vargs)
    this._client = vargs.shift()
    this._rewrite = coalesce(vargs.shift(), nop)
    this._destructible = new Destructible(timeout, 'conduit/request')
}

// http://stackoverflow.com/a/5426648
Request.prototype.middleware = cadence(function (async, request, response) {
    var receiver = { read: new Procession, write: new Procession }
    var responder = new Consumer(response, 'conduit/middleware')
    receiver.write.shifter().pump(responder, 'enqueue')
    var header = new Header(request)
    this._rewrite.call(null, header)
    this._client.connect({
        module: 'conduit/requester',
        method: 'header',
        body: header
    }, receiver)
    Sender(request, receiver.read, 'conduit/requester', async())
})

module.exports = Request
