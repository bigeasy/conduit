// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

// Contextualized callbacks and event handlers.
var Operation = require('operation/variadic')

var Socket = require('./socket')

var util = require('util')
var Pumpable = require('./pumpable')

function Server () {
    Pumpable.call(this, 'server')

    this._connect = Operation(Array.prototype.slice.call(arguments))

    this._sockets = {}

    this.read = new Procession
    this.write = new Procession

    this._pump(false, 'write', this.write, this, '_write')
}
util.inherits(Server, Pumpable)

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
        var receiver = this._connect.call(null, envelope.body)
        var socket = this._sockets[envelope.identifier] = new Socket(this, envelope.identifier, receiver)
        socket.cookie = this._destructible.destruct.wait(socket, 'destroy')
        socket.listen(this._destructible.rescue([ 'socket', envelope.identifier ]))
    } else if (
        envelope.module == 'conduit/socket' &&
        envelope.method == 'envelope'
    ) {
        this._sockets[envelope.identifier]._receive(envelope.body, async())
    }
})

module.exports = Server
