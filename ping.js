var cadence = require('cadence')
var coalesce = require('extant')
var Procession = require('procession')

function Ping (destructible, receiver, options) {
    this._timeout = coalesce(options.timeout, 5000)
    this._interval = setInterval(this._ping.bind(this), coalesce(options.ping, this._timeout / 2))
    this._lastPingAt = Date.now()
    destructible.destruct.wait(this, function () { clearInterval(this._interval) })

    this._destructible = destructible

    this.outbox = new Procession
    this.inbox = new Procession

    receiver.outbox.pump(this.outbox)

    this.inbox.pump(this, '_enqueue', destructible.monitor('inbox'))

    this.receiver = receiver
}

Ping.prototype._ping = function () {
    if (Date.now() - this._lastPingAt > this._timeout) {
        this._destructible.destroy()
    } else {
        this.outbox.push({ module: 'conduit/ping', method: 'ping' })
    }
}

Ping.prototype._enqueue = cadence(function (async, envelope) {
    if (
        envelope != null &&
        envelope.module === 'conduit/ping' &&
        envelope.method === 'pong'
    ) {
        this._lastPingAt = Date.now()
    } else {
        this.receiver.inbox.push(envelope)
    }
})

module.exports = cadence(function (async, destructible, receiver, options) {
    return new Ping(destructible, receiver, coalesce(options, {}))
})
