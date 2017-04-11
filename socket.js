var cadence = require('cadence')
var Procession = require('procession')
var Destructible = require('destructible')

function Socket (controller, identifier) {
    this._identifier = identifier
    this._controller = controller
    this.destroyed = false
    this.read = new Procession
    this.write = new Procession
    this.wrote = new Procession
    this.write.pump(this)
    this._destructible = new Destructible([ 'socket', identifier ])
    this._destructible.markDestroyed(this)
    this._destructible.addDestructor('destroy', this, '_destroy')
}

Socket.prototype.destroy = function () {
    this._destructible.destroy()
}

// TODO Would really have to think hard about how to cancel pumping, possible,
// but probably no more complicated that what we have here.
Socket.prototype._destroy = function () {
    this.read.push(null)
    delete this._controller._sockets[this._identifier]
}

Socket.prototype.enqueue = cadence(function (async, envelope) {
    if (this.destroyed) {
        return []
    }
    async(function () {
        this._controller.write.enqueue({
            module: 'conduit/socket',
            method: 'socket',
            to: this._controller._qualifier,
            socket: this._identifier,
            body: envelope
        }, async())
    }, function () {
        this.wrote.enqueue(envelope, async())
    }, function () {
        if (this.write.endOfStream && this.read.endOfStream) {
            this.destroy()
        }
        return []
    })
})

module.exports = Socket
