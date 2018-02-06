// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')
var Pump = require('procession/pump')

var assert = require('assert')

var Destructible = require('destructible')

var util = require('util')
var Pumpable = require('./pumpable')

function Multiplexer (routes) {
    Pumpable.call(this, 'multiplexer')

    this.read = new Procession
    this.write = new Procession

    this._pump(false, 'dispatch', this.write, this, '_dispatch')

    this._receivers = {}

    for (var qualifier in routes) {
        this._route(qualifier, routes[qualifier])
    }
}
util.inherits(Multiplexer, Pumpable)

Multiplexer.prototype._route = function (qualifier, receiver) {
    this._receivers[qualifier] = receiver
    this._pump(false, [ 'receiver', qualifier ], receiver.read, this, function (envelope) {
        this._envelop(qualifier, envelope)
    })
}

Multiplexer.prototype._dispatch = cadence(function (async, envelope) {
    if (envelope == null) {
        async.forEach(function (qualifier) {
            this._receivers[qualifier].write.enqueue(null, async())
        })(Object.keys(this._receivers))
    } else if (
        envelope.module == 'conduit/multiplexer' &&
        envelope.method == 'envelope' &&
        this._receivers[envelope.qualifier] != null
    ) {
        this._receivers[envelope.qualifier].write.enqueue(envelope.body, async())
    }
})

Multiplexer.prototype._envelop = function (qualifier, envelope) {
    this.read.push({
        module: 'conduit/multiplexer',
        method: 'envelope',
        qualifier: qualifier,
        body: envelope
    })
}

module.exports = Multiplexer
