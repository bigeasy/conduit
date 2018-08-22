// Node.js API.
var assert = require('assert')

// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

// Ever increasing serial value with no maximum value.
var Monotonic = require('monotonic').asString

// Return the first not null-like value.
var coalesce = require('extant')

// Do nothing.
var noop = require('nop')

function Window (destructible, receiver, options) {
    this.outbox = new Procession
    this.inbox = new Procession

    this._receiver = receiver

    this._queue = new Procession
    this._reservoir = this._queue.shifter()

    // TODO Hate the world `reconnect`.
    // Pump to nowhere until we get our first reconnect message.
    this._pumper = this._queue.pump(new Procession)

    this._received = '0'
    this._sequence = '0'

    this._window = coalesce(options.window, 64)

    this._flush = Monotonic.add('0', this._window)

    this.destroyed = false
    destructible.markDestroyed(this)

    this.inbox.pump(this, '_read', destructible.monitor('read'))
    this._receiver.outbox.pump(this, '_write', destructible.monitor('write'))

    this.reconnections = 0
}

Window.prototype.reconnect = function () {
    this.outbox.push({
        module: 'conduit/window',
        method: 'connect',
        reconnection: ++this.reconnections
    })
}

// Why does reconnect work? Well, one side is going to realize that the
// connection is broken and close it. If it is the client side then it will open
// a new connection and the server will know to replace it. It will destroy its
// Conduit and give the window to a new conduit. It will then send the reconnect
// message (or rebuffer or something) and the client will reply.
//
// If the server detects disconnection, then the client might keep on chatting
// with a half-open socket indefinately. We might want to add a keep-alive
// reciever that will destroy the socket, or we might decide to add keep-alive
// to this here, splitting it out only if we decide that we want to have
// alternative flow-control methods.
//
// Actually, for now we could have keep-alive as a seprate receiver. It has a
// Signal you can wire to destroy your Conduit. Simpler and we can optimize it
// away if it is too expensive. (Rather optimize Procession so we're not shy
// about creating pipelines.)
//
// Anyway, with a keep-alive, the server can disconnect and just chill. The
// client can timeout and then go through the reconnect. It is not going to
// empty it's queue until it gets a flush and it won't get one off the closed
// socket.

//
Window.prototype._read = cadence(function (async, envelope) {
    if (envelope == null) {
        this._receiver.inbox.push(null)
    } else if (
        envelope.module == 'conduit/window'
    ) {
        switch (envelope.method) {
        case 'connect':
            this._pumper.destroy()
            var reservoir = this._reservoir.shifter()
            this._pumper = this._reservoir.pumpify(this.outbox)
            this._reservoir = reservoir
            if (envelope.reconnection !== this.reconnections) {
                this.reconnect()
            }
            break
        case 'envelope':
            // If we've seen this one already, don't bother.
            if (Monotonic.compare(this._received, envelope.sequence) >= 0) {
                return
            }
            // We might lose an envelope. We're going to count on this being a
            // break where a conduit reconnect causes the messages to be resent
            // but we could probably request a replay ourselves.
            if (this._received != envelope.previous) {
                // We maybe could use the sequence we're at as a version number.
                return
            }
            // Note the last received sequence.
            this._received = envelope.sequence
            // Send a flush if we've reached the end of a window.
            if (this._received == this._flush) {
                this.outbox.push({
                    module: 'conduit/window',
                    method: 'flush',
                    sequence: this._window
                })
                this._flush = Monotonic.add(this._flush, this._window)
            }
            // Forward the body.
            this._receiver.inbox.enqueue(envelope.body, async())
            break
        case 'flush':
            // Shift the messages that we've received off of the reservoir.
            for (;;) {
                var peek = this._reservoir.peek()
                if (peek == null || peek.sequence == envelope.sequence) {
                    break
                }
                this._reservoir.shift()
            }
            break
        }
    }
})

// Input into window from nested listener. It is wrapped in an envelope and
// added to a queue.

//
Window.prototype._write = function (envelope) {
    if (envelope == null) {
        this._queue.push(null)
    } else {
        this._queue.push({
            module: 'conduit/window',
            method: 'envelope',
            previous: this._sequence,
            sequence: this._sequence = Monotonic.increment(this._sequence, 0),
            body: envelope
        })
    }
}

module.exports = cadence(function (async, destructible, receiver, options) {
    return new Window(destructible, receiver, coalesce(options, {}))
})
