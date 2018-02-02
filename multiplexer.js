// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

var assert = require('assert')

function Multiplexer (routes) {
    this.read = new Procession
    this.write = new Procession

    this._shifter = this.write.shifter()

    this._routes = {}

    for (var qualifier in routes) {
        this._route(qualifier, routes[qualifier])
    }
}

Multiplexer.prototype.listen = function (callback) {
    assert(this._shifter != null, 'shifter')
    new Pump(this._shifter, this, '_dispatch').pump(callback)
}

Multiplexer.prototype.destroy = function () {
    this._shifter.destroy()
    this._shifter = null
}

Multiplexer.prototype._route = function (qualifier, receiver) {
    this._routes[qualifier] = {
        receiver: receiver,
        pump: receiver.read.shifter().pump(this, function (envelope) {
            this._envelop(qualifier, envelope)
        })
    }
}

Multiplexer.prototype._dispatch = cadence(function (async, envelope) {
    if (envelope == null) {
        async.forEach(function (qualifier) {
            this._routes[qualifier].receiver.write.enqueue(null, async())
        })(Object.keys(this._routes))
    } else if (
        envelope.module == 'conduit/multiplexer' &&
        envelope.method == 'envelope' &&
        this._routes[envelope.qualifier] != null
    ) {
        this._routes[envelope.qualifier].receiver.write.enqueue(envelope.body, async())
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
