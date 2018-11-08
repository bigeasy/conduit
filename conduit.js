// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

// Contextualized callbacks and event handlers.
var Operation = require('operation')

var Turnstile = require('turnstile')
Turnstile.Queue = require('turnstile/queue')

var Cache = require('magazine')

var Monotonic = require('monotonic').asString

function Conduit (destructible, inbox, outbox, vargs) {
    this._connect = vargs[0] != null ? new Operation(vargs) : null

    this._outbox = outbox

    inbox.pump(this, '_receive').run(destructible.monitor('receive'))

    this.turnstile = new Turnstile
    this._requests = new Turnstile.Queue(this, '_request', this.turnstile)

    this.turnstile.listen(destructible.monitor('turnstile'))
    destructible.destruct.wait(this.turnstile, 'close')

    this._destructible = destructible
    this._identifier = '0'

    this._sockets = new Cache().createMagazine()
}

Conduit.prototype._request = cadence(function (async, envelope) {
    var enqueued = envelope.body
    async(function () {
        this._connect.call(null, enqueued.request, enqueued.inbox, enqueued.outbox, async())
    }, function (response) {
        if (!enqueued.request.inbox) {
            this._outbox.push({
                module: 'conduit/server',
                method: 'response',
                identifier: enqueued.identifier,
                body: response
            })
            this._close('there:' + enqueued.identifier)
        }
    })
})

Conduit.prototype._close = function (identifier) {
    var cartridge = this._sockets.hold(identifier, { open: 1, outbox: [] })
    if (--cartridge.value.open == 0) {
        cartridge.value.outbox.push(null)
        cartridge.remove()
    } else {
        cartridge.release()
    }
}

Conduit.prototype.expire = function (before) {
    var iterator = this._sockets.iterator()
    while (!iterator.end && iterator.when < before) {
        var socket = this._sockets.remove(iterator.key)
        socket.inbox.push(null)
        socket.outbox.push(null)
        iterator.previous()
    }
}

Conduit.prototype._receive = cadence(function (async, envelope) {
    if (envelope == null) {
        this._outbox = new Procession // acts as a null sink for any writes
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
        this._sockets.put('there:' + envelope.identifier, socket)
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
                this._outbox.push({
                    module: 'conduit/server',
                    method: 'envelope',
                    identifier: enqueue.identifier,
                    body: envelope
                })
                if (envelope == null) {
                    this._close('there:' + enqueue.identifier)
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
        this._sockets.get('there:' + envelope.identifier).inbox.push(envelope.body)
        if (envelope.body == null) {
            this._close('there:' + envelope.identifier)
        }
    } else if (
        envelope.module == 'conduit/server' &&
        envelope.method == 'response'
    ) {
        var cartridge = this._sockets.hold('here:' + envelope.identifier, null)
        cartridge.value.inbox.push(envelope.body)
        cartridge.value.inbox.push(null)
        cartridge.remove()
    } else if (
        envelope.module == 'conduit/server' &&
        envelope.method == 'envelope'
    ) {
        this._sockets.get('here:' + envelope.identifier).inbox.push(envelope.body)
        if (envelope.body == null) {
            this._close('here:' + envelope.identifier)
        }
    }
})

Conduit.prototype.connect = function (request) {
    var response = { inbox: null, outbox: null }, inbox = null, outbox = null, open = 1
    if (request.outbox) {
        open++
        outbox = response.outbox = new Procession
        outbox.pump(this, function (envelope) {
            this._outbox.push({
                module: 'conduit/client',
                method: 'envelope',
                identifier: identifier,
                body: envelope
            })
            if (envelope == null) {
                this._close('here:' + identifier)
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
    socket.inbox.identifier = 'here:' + identifier
    this._sockets.put('here:' + identifier, socket)
    this._outbox.push({
        module: 'conduit/client',
        method: 'connect',
        identifier: identifier,
        body: request
    })
    return response
}

module.exports = cadence(function (async, destructible, inbox, outbox) {
    return new Conduit(destructible, inbox, outbox, Array.prototype.slice.call(arguments, 4))
})
