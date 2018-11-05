// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

var assert = require('assert')

var Destructible = require('destructible')

function Multiplexer (routes) {
    this.outbox = new Procession
    this.inbox = new Procession
    this.conduits = {}
    this._eos = 0
}

// Note that our pumps are not going to error because they are nothing more than
// copies. We still use `Destructible` to signal that we're coming to a close,
// but we don't cancel the pumps. We wait for the end-of-stream.

//
Multiplexer.prototype._monitor = cadence(function (async, destructible, routes) {
    async(function () {
        this.inbox.pump(this, '_dispatch', destructible.monitor('dispatch'))
        async.forEach(function (qualifier) {
            var receiver = this.conduits[qualifier] = routes[qualifier]
            receiver.outbox.pump(this, function (envelope) {
                this._envelop(qualifier, envelope)
            }, destructible.monitor([ 'receiver', 'envelop', qualifier ]))
        })(Object.keys(routes))
    }, function () {
        return [ this ]
    })
})

Multiplexer.prototype._dispatch = cadence(function (async, envelope) {
    if (envelope == null) {
        async.forEach(function (qualifier) {
            this.conduits[qualifier].inbox.enqueue(null, async())
        })(Object.keys(this.conduits))
    } else if (
        envelope.module == 'conduit/multiplexer' &&
        envelope.method == 'envelope' &&
        this.conduits[envelope.qualifier] != null
    ) {
        this.conduits[envelope.qualifier].inbox.enqueue(envelope.body, async())
    }
})

Multiplexer.prototype._envelop = function (qualifier, envelope) {
    if (envelope == null) {
        if (++this._eos === Object.keys(this.conduits).length) {
            this.outbox.push(null)
        }
    } else {
        this.outbox.push({
            module: 'conduit/multiplexer',
            method: 'envelope',
            qualifier: qualifier,
            body: envelope
        })
    }
}

module.exports = cadence(function (async, destructible, routes) {
    new Multiplexer()._monitor(destructible, routes, async())
})
