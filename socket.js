// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

function Socket (controller, identifier, receiver) {
    this._identifier = identifier
    this._controller = controller

    this._receiver = receiver
    this._receiver.read.shifter().pump(this, '_send')
}

Socket.prototype._checkEndOfStream = function () {
    if (this._receiver.write.endOfStream && this._receiver.read.endOfStream) {
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
