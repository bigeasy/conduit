var cadence = require('cadence')
var coalesce = require('extant')
var Procession = require('procession')
var abend = require('abend')

function Ping (destructible, receiver, options) {
    this._timeout = coalesce(options.timeout, 5000)
    this._frequency = coalesce(options.ping, this._timeout / 2)
    this._lastPingAt = Date.now()

    this._destructible = destructible

    this._checker = setInterval(this._check.bind(this), coalesce(this._frequency, this._timeout / 2))
    this._destructible.destruct.wait(this, function () { clearInterval(this._checker) })

    this.outbox = new Procession
    this.inbox = new Procession

    receiver.outbox.pump(this.outbox, 'enqueue').run(abend)

    this.inbox.pump(this, '_enqueue').run(destructible.monitor('inbox'))

    this.receiver = receiver

    this.start()
}

Ping.prototype.start = function () {
    this.stop()
    this._pinger = setInterval(this._ping.bind(this), coalesce(this._frequency, this._timeout / 2))
    this._stopper = this._destructible.destruct.wait(this, function () { clearInterval(this._pinger) })
}

Ping.prototype.stop = function () {
    if (this._stopper != null) {
        this._destructible.destruct.cancel(this._stopper)()
        this._stopper = null
    }
}

Ping.prototype._check = function () {
    if (Date.now() - this._lastPingAt > this._timeout) {
        this._destructible.destroy()
    }
}

Ping.prototype._ping = function () {
    this.outbox.push({ module: 'conduit/ping', method: 'ping' })
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
