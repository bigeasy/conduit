// Control-flow utilities.
var cadence = require('cadence')

// Ever increasing serial value with no maximum value.
var Monotonic = require('monotonic').asString

// An evented message queue.
var Procession = require('procession')

var Socket = require('./socket')

var util = require('util')
var Pumpable = require('./pumpable')

function Client () {
    Pumpable.call(this, 'client')

    this._identifier = '0'
    this._sockets = {}

    this.write = new Procession
    this.read = new Procession

    this._pump(false, 'enqueue', this.write, this, '_enqueue')
}
util.inherits(Client, Pumpable)

Client.prototype.connect = function (header, receiver) {
    var identifier = this._identifier = Monotonic.increment(this._identifier, 0)
    var socket = this._sockets[identifier] = new Socket(this, identifier, receiver)
    socket.cookie = this._destructible.destruct.wait(socket, 'destroy')
    socket.listen(this._destructible.rescue([ 'socket', identifier ]))
    this.read.push({
        module: 'conduit/client',
        method: 'connect',
        identifier: identifier,
        body: header
    })
}

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

module.exports = Client
