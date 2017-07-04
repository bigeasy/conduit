// Control-flow utilities.
var cadence = require('cadence')

// Ever increasing serial value with no maximum value.
var Monotonic = require('monotonic').asString

// An evented message queue.
var Procession = require('procession')

var Socket = require('./socket')

function Client () {
    this._identifier = '0'
    this._sockets = {}

    this.write = new Procession
    this.read = new Procession

    this.write.shifter().pump(this, '_enqueue')
}

Client.prototype.connect = function (header, receiver) {
    var identifier = this._identifier = Monotonic.increment(this._identifier, 0)
    this._sockets[identifier] = new Socket(this, identifier, receiver)
    this.read.push({
        module: 'conduit/client',
        method: 'connect',
        identifier: identifier,
        body: header
    })
}

Client.prototype._enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        async.forEach(function (identifier) {
            this._sockets[identifier]._receive(null, async())
        })(Object.keys(this._sockets))
    } else if (
        envelope.module == 'conduit/socket' &&
        envelope.method == 'envelope'
    ) {
        this._sockets[envelope.identifier]._receive(envelope.body, async())
    }
})

module.exports = Client
