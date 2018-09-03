var Procession = require('procession')
var cadence = require('cadence')
var coalesce = require('extant')

function Pong (destructible, receiver, options) {
    this._timeout = coalesce(options.timeout, 5000)
    this._interval = setInterval(this._checkTimeout.bind(this), this._timeout / 2)
    this._lastPingAt = Date.now()

    destructible.destruct.wait(this, function () { clearInterval(this._interval) })

    this._destructible = destructible

    this.outbox = new Procession
    this.inbox = new Procession

    this.receiver = receiver

    receiver.outbox.pump(this.outbox)
    this.inbox.pump(this, '_enqueue', destructible.monitor('inbox'))
}

Pong.prototype._checkTimeout = function () {
    if (Date.now() - this._lastPingAt > this._timeout) {
        this._destructible.destroy()
    }
}

Pong.prototype._enqueue = cadence(function (async, envelope) {
    if (
        envelope != null &&
        envelope.module === 'conduit/ping' &&
        envelope.method === 'ping'
    ) {
        this._lastPingAt = Date.now()
        this.outbox.push({ module: 'conduit/ping', method: 'pong' })
    } else {
        this.receiver.inbox.push(envelope)
    }
})

module.exports = cadence(function (async, destructible, receiver, options) {
    return new Pong(destructible, receiver, coalesce(options, {}))
})
