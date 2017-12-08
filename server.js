// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

// Contextualized callbacks and event handlers.
var Operation = require('operation/variadic')

var Socket = require('./socket')

function Server () {
    this._connect = Operation(Array.prototype.slice.call(arguments))

    this._sockets = {}

    this.read = new Procession
    this.write = new Procession

    this.write.shifter().pump(this, '_write')
}

Server.prototype._write = cadence(function (async, envelope) {
    if (envelope == null) {
        this.read = new Procession // acts as a null sink for any writes
        async.forEach(function (identifier) {
            this._sockets[identifier]._receive(null, async())
            delete this._sockets[identifier]
        })(Object.keys(this._sockets))
    } else if (
        envelope.module == 'conduit/client' &&
        envelope.method == 'connect'
    ) {
        this._sockets[envelope.identifier] = new Socket(this, envelope.identifier, this._connect.call(null, envelope.body))
    } else if (
        envelope.module == 'conduit/socket' &&
        envelope.method == 'envelope'
    ) {
        this._sockets[envelope.identifier]._receive(envelope.body, async())
    }
})

module.exports = Server
