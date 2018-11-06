// Control-flow utilities.
var cadence = require('cadence')

// Ever increasing serial value with no maximum value.
var Monotonic = require('monotonic').asString

// An evented message queue.
var Procession = require('procession')

var Cache = require('magazine')

function Client (destructible) {
    this.monitoring = false
    this.destroyed = false

    this._identifier = '0'

    this.inbox = new Procession
    this.outbox = new Procession

    this.inbox.pump(this, '_receive').run(destructible.monitor('receive'))

    this._destructible = destructible

    this._sockets = new Cache().createMagazine()
}

Client.prototype._close = function (identifier) {
    var cartridge = this._sockets.hold(identifier, { open: 1, outbox: [] })
    if (--cartridge.value.open == 0) {
        cartridge.value.outbox.push(null)
        cartridge.remove()
    } else {
        cartridge.release()
    }
}

Client.prototype.connect = function (request) {
    var response = { inbox: null, outbox: null }, inbox = null, outbox = null, open = 1
    if (request.outbox) {
        open++
        outbox = response.outbox = new Procession
        outbox.pump(this, function (envelope) {
            this.outbox.push({
                module: 'conduit/client',
                method: 'envelope',
                identifier: identifier,
                body: envelope
            })
            if (envelope == null) {
                this._close(identifier)
            }
        }).run(this._destructible.monitor([ 'socket', identifier ], true))
    } else {
        outbox = []
    }
    inbox = new Procession
    response.inbox = inbox.shifter()
    var identifier = this._identifier = Monotonic.increment(this._identifier, 0)
    var socket = {
        open: open,
        request: request,
        inbox: inbox,
        outbox: outbox
    }
    this._sockets.put(identifier, socket)
    this.outbox.push({
        module: 'conduit/client',
        method: 'connect',
        identifier: identifier,
        body: request
    })
    return response
}

Client.prototype.expire = function (before) {
    var iterator = this._sockets.iterator()
    while (!iterator.end && iterator.when < before) {
        var socket = this._sockets.remove(iterator.key)
        socket.inbox.push(null)
        socket.outbox.push(null)
        iterator.previous()
    }
}

Client.prototype._receive = cadence(function (async, envelope) {
    if (envelope == null) {
        this.outbox = new Procession // acts as a null sink for any writes
        this.expire(Infinity)
    } else if (
        envelope.module == 'conduit/server' &&
        envelope.method == 'response'
    ) {
        var cartridge = this._sockets.hold(envelope.identifier, null)
        cartridge.value.inbox.push(envelope.body)
        cartridge.value.inbox.push(null)
        cartridge.remove()
    } else if (
        envelope.module == 'conduit/server' &&
        envelope.method == 'envelope'
    ) {
        this._sockets.get(envelope.identifier).inbox.push(envelope.body)
        if (envelope.body == null) {
            this._close(envelope.identifier)
        }
    }
})

module.exports = cadence(function (async, destructible) {
    return new Client(destructible)
})
