// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

var util = require('util')
var Pumpable = require('./pumpable')

function Socket (controller, identifier, receiver) {
    Pumpable.call(this, 'socket')

    this._identifier = identifier
    this._controller = controller

    this._receiver = receiver

    this._pump(false, 'send', this._receiver.read, this, '_send')
}
util.inherits(Socket, Pumpable)

Socket.prototype._checkEndOfStream = function () {
    if (this._receiver.write.endOfStream && this._receiver.read.endOfStream) {
        this._controller._destructible.destruct.cancel(this.cookie)
        delete this._controller._sockets[this._identifier]
    }
}

Socket.prototype._receive = cadence(function (async, envelope) {
    async(function () {
        this._receiver.write.enqueue(envelope, async())
    }, function () {
        this._checkEndOfStream()
    })
})

Socket.prototype._send = cadence(function (async, envelope) {
    async(function () {
        this._controller.read.enqueue({
            module: 'conduit/socket',
            method: 'envelope',
            identifier: this._identifier,
            body: envelope
        }, async())
    }, function() {
        this._checkEndOfStream()
    })
})

module.exports = Socket
