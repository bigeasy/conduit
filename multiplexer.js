// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

function Multiplexer () {
    this.read = new Procession
    this.write = new Procession

    this.write.shifter().pump(this, '_dispatch')

    this._routes = {}
}

Multiplexer.prototype.route = function (qualifier, receiver) {
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
