// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

// Contextualized callbacks and event handlers.
var Operation = require('operation')

var Turnstile = require('turnstile')
Turnstile.Queue = require('turnstile/queue')

var Cache = require('magazine')

function Server (destructible, connect) {
    this._connect = connect

    this.outbox = new Procession
    this.inbox = new Procession

    this.inbox.pump(this, '_receive').run(destructible.monitor('receive'))

    this.turnstile = new Turnstile
    this._requests = new Turnstile.Queue(this, '_request', this.turnstile)

    this.turnstile.listen(destructible.monitor('turnstile'))
    destructible.destruct.wait(this.turnstile, 'close')

    this._destructible = destructible

    this._sockets = new Cache().createMagazine()
}

Server.prototype._request = cadence(function (async, envelope) {
    var enqueued = envelope.body
    async(function () {
        this._connect.call(null, enqueued.request, enqueued.inbox, enqueued.outbox, async())
    }, function (response) {
        if (!enqueued.request.inbox) {
            this.outbox.push({
                module: 'conduit/server',
                method: 'response',
                identifier: enqueued.identifier,
                body: response
            })
            this._close(enqueued.identifier)
        }
    })
})

Server.prototype._close = function (identifier) {
    var cartridge = this._sockets.hold(identifier, { open: 1, outbox: [] })
    console.log('>>>>', cartridge.value)
    if (--cartridge.value.open == 0) {
        cartridge.value.outbox.push(null)
        cartridge.remove()
    } else {
        cartridge.release()
    }
}

Server.prototype.expire = function (before) {
    var iterator = this._sockets.iterator()
    while (!iterator.end && iterator.when < before) {
        var socket = this._sockets.remove(iterator.key)
        console.log(socket)
        socket.inbox.push(null)
        socket.outbox.push(null)
        iterator.previous()
    }
}

Server.prototype._receive = cadence(function (async, envelope) {
    if (envelope == null) {
        this.outbox = new Procession // acts as a null sink for any writes
        this.expire(Infinity)
    } else if (
        envelope.module == 'conduit/client' &&
        envelope.method == 'connect'
    ) {
        var enqueue = {
            request: envelope.body,
            identifier: envelope.identifier,
            inbox: null,
            outbox: null
        }
        var socket = { open: 1, inbox: null, outbox: [] }
        this._sockets.put(envelope.identifier, socket)
        if (enqueue.request.outbox) {
            socket.inbox = new Procession
            enqueue.inbox = socket.inbox.shifter()
        } else {
            enqueue.inbox = []
        }
        if (enqueue.request.inbox) {
            socket.open++
            socket.outbox = enqueue.outbox = new Procession
            enqueue.outbox.pump(this, function (envelope) {
                this.outbox.push({
                    module: 'conduit/server',
                    method: 'envelope',
                    identifier: enqueue.identifier,
                    body: envelope
                })
                if (envelope == null) {
                    this._close(enqueue.identifier)
                }
            }).run(this._destructible.monitor([ 'socket', enqueue.identifier ], true))
        } else {
            enqueue.outbox = socket.outbox = []
        }
        this._requests.push(enqueue)
    } else if (
        envelope.module == 'conduit/client' &&
        envelope.method == 'envelope'
    ) {
        this._sockets.get(envelope.identifier).inbox.push(envelope.body)
        if (envelope.body == null) {
            this._close(envelope.identifier)
        }
    }
})

module.exports = cadence(function (async, destructible) {
    return new Server(destructible, Operation(Array.prototype.slice.call(arguments, 2)))
})
