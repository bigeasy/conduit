// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

var Pump = require('procession/pump')

var assert = require('assert')

function Socket (controller, identifier, receiver) {
    this._identifier = identifier
    this._controller = controller

    this.destroyed = false
    this.monitoring = false

    this._receiver = receiver
}

Socket.prototype.monitor = cadence(function (async, destructible) {
    destructible.monitor('send', new Pump(this._receiver.read.shifter(), this, '_send'), 'monitor', async())
})

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
