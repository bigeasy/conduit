// Control-flow utilities.
var cadence = require('cadence')

// Ever increasing serial value with no maximum value.
var Monotonic = require('monotonic').asString

// An evented message queue.
var Procession = require('procession')

var Socket = require('./socket')

var util = require('util')
var Pump = require('procession/pump')

var assert = require('assert')

function Client (destructible) {
    this.monitoring = false
    this.destroyed = false

    this._identifier = '0'
    this._sockets = {}

    this.write = new Procession
    this.read = new Procession

    new Pump(this.write.shifter(), this, '_enqueue').pumpify(destructible.monitor('read'))

    this._destructible = destructible
}

Client.prototype.connect = cadence(function (async, receiver, header) {
    var vargs = Array.prototype.slice.call(arguments, 1)
    var identifier = this._identifier = Monotonic.increment(this._identifier, 0)
    async(function () {
        var socket = this._sockets[identifier] = new Socket(this, identifier, receiver)
        async(function () {
            this._destructible.monitor([ 'socket', identifier ], true, socket, 'monitor', async())
        }, function () {
            this.read.push({
                module: 'conduit/client',
                method: 'connect',
                identifier: identifier,
                body: header
            })
        })
    })
})

Client.prototype._enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        this.read = new Procession // acts as a null sink for any writes
        async.forEach(function (identifier) {
            this._sockets[identifier]._receive(null, async())
            delete this._sockets[identifier]
        })(Object.keys(this._sockets))
    } else if (
        envelope.module == 'conduit/socket' &&
        envelope.method == 'envelope'
    ) {
        this._sockets[envelope.identifier]._receive(envelope.body, async())
    }
})

module.exports = cadence(function (async, destructible) {
    return new Client(destructible)
})
