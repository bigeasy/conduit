// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

var assert = require('assert')

function Socket (controller, identifier, receiver) {
    this._identifier = identifier
    this._controller = controller

    this.destroyed = false
    this.monitoring = false

    this._receiver = receiver
}

Socket.prototype.monitor = cadence(function (async, destructible) {
    destructible.destruct.wait(this, function () { this._receiver.outbox.push(null) })
    this._receiver.outbox.shifter().pump(this, '_send', destructible.monitor('send'))
})

Socket.prototype._receive = cadence(function (async, envelope) {
    async(function () {
        this._receiver.inbox.enqueue(envelope, async())
    }, function () {
        if (envelope == null) {
            delete this._controller._sockets[this._identifier]
        }
    })
})

Socket.prototype._send = cadence(function (async, envelope) {
    async(function () {
        this._controller.outbox.enqueue({
            module: 'conduit/socket',
            method: 'envelope',
            identifier: this._identifier,
            body: envelope
        }, async())
    }, function() {
        // TODO No longer certain that sockets are not leaking.
        // if (envelope == null) {
        //     delete this._controller._sockets[this._identifier]
        // }
        // this._checkEndOfStream()
    })
})

module.exports = Socket
