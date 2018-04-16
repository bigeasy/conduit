// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

var assert = require('assert')

var Destructible = require('destructible')

function Multiplexer (routes) {
    this.read = new Procession
    this.write = new Procession
    this._routes = {}
}

Multiplexer.prototype._monitor = cadence(function (async, destructible, routes) {
    async(function () {
        this.write.shifter().pump(this, '_dispatch', destructible.monitor('dispatch'))
        async.forEach(function (qualifier) {
            var receiver = this._routes[qualifier] = routes[qualifier]
            var shifter = receiver.read.shifter()
            destructible.destruct.wait(shifter, 'destroy')
            shifter.pump(this, function (envelope) {
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
            this._routes[qualifier].write.enqueue(null, async())
        })(Object.keys(this._routes))
    } else if (
        envelope.module == 'conduit/multiplexer' &&
        envelope.method == 'envelope' &&
        this._routes[envelope.qualifier] != null
    ) {
        this._routes[envelope.qualifier].write.enqueue(envelope.body, async())
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

module.exports = cadence(function (async, destructible, routes) {
    new Multiplexer()._monitor(destructible, routes, async())
})
