// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

// Ever increasing serial value with no maximum value.
var Monotonic = require('monotonic').asString

// Return the first not null-like value.
var coalesce = require('extant')

var Signal = require('signal')

var abend = require('abend')

var Interrupt = require('interrupt').createInterrupter('conduit/window')

function Window (destructible, options) {
    this.outbox = new Procession
    this.inbox = new Procession


    this._received = '0'
    this._sequence = '0'

    this._window = coalesce(options.window, 64)

    this._flush = Monotonic.add('0', this._window)

    this.destroyed = false
    destructible.destruct.wait(this, function () { this.destroyed = true })

    this._destructible = destructible

    this.outbox.pump(this, '_send').run(destructible.ephemeral('outbox'))

    this._socket = {
        inbox: new Procession().shifter(),
        outbox: new Procession,
        destructible: { completed: new Signal }
    }
    this._reservoir = this._socket.outbox.shifter()

    this._socket.destructible.completed.unlatch()

    this._connection = 0
}

Window.prototype._connect = cadence(function (async, destructible, inbox, outbox) {
    async(function () {
        // Shutdown our previous connections to a bi-directional pair.
        // TODO Possible race when two or more calls to `_connect` wait for the
        // previous socket to destruct.
        // TODO We could at least assert that `completed` has unlatched.
        this._socket.inbox.destroy()
        this._socket.destructible.completed.wait(async())
    }, function () {
        // Read the new input into our `_pull` function.
        var pump = inbox.pump(this, '_receive')
        pump.run(destructible.durable('inbox'))
        var reservoir = this._reservoir
        this._reservoir = outbox.shifter()
        var entry
        while ((entry = reservoir.shift()) != null) {
            outbox.push(entry)
        }
        this._socket.outbox.end()
        this._socket = { inbox: pump, outbox: outbox, destructible: destructible }
    })
})

Window.prototype.connect = function (inbox, outbox) {
    this._destructible.ephemeral([ 'connect', this._connection++ ], this, '_connect', inbox, outbox, null)
}

// We can shutdown our side of the window by running null through the window's
// outbox. The other side can shutdown down the inbox during normal operation,
// but if the connection to the other side is cut and not coming back, we need
// to be able to send a wrapped end of stream through the inbox. We don't have
// the counter on the the ohter side and our Procession queues are generally
// opaque, so we don't want to poke around in them for a counter.
//
// Thus, this is a way to hangup the inbox, but let's call it truncate.

// We need a hangup because we are resisting shutting down due to end of stream
// and rejecting messages that are out of order. We'd need to put an envelope
// with a `null` body right at the of the stream with the correct sequence. The
// queue doesn't really have a good way of looking at the input end, maybe it
// does, but I haven't used it. Could use it, it's just the head of the inbox,
// but we're filtering the inbox for our specific envelopes still, so we're not
// expecting the inbox to contain only content related to us, so we have to
// scan the inbox. Forget that. Let's just have a special control message.
Window.prototype.truncate = function () {
    this._socket.inbox.destroy()
    this._socket.destructible.completed.wait(this, function () {
        this.inbox.end()
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
Window.prototype._receive = cadence(function (async, envelope) {
    if (envelope == null) {
        // Nothing to do really, it will have canceled our pump to this
        // function, so now we're going to wait for a reconnect.
    } else if (envelope.module == 'conduit/window') {
        switch (envelope.method) {
        case 'envelope':
            // If we've seen this one already, don't bother.
            if (Monotonic.compare(this._received, envelope.sequence) >= 0) {
                break
            }
            // We might lose an envelope. We're going to count on this being a
            // break where a conduit reconnect causes the messages to be resent
            // but we could probably request a replay ourselves.
            Interrupt.assert(this._received == envelope.previous, 'ahead')
            // Note the last received sequence.
            this._received = envelope.sequence
            // Send a flush if we've reached the end of a window.
            if (this._received == this._flush) {
                this._socket.outbox.push({
                    module: 'conduit/window',
                    method: 'flush',
                    sequence: this._received
                })
                this._flush = Monotonic.add(this._flush, this._window)
            }
            // Forward the body which might actually be `null` end-of-stream.
            this.inbox.enqueue(envelope.body, async())
            break
        case 'flush':
            // Shift the messages that we've received off of the reservoir.
            for (;;) {
                var peek = this._reservoir.peek()
                // TODO `peek` should never be `null`.
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
// TODO Place a nested `null` here. You may want to assert that you've shutdown
// the Window with a guard, or you can start to destroy the Window. Are
// end-of-stream and destruction separate concerns? Probably not, no.

//
Window.prototype._send = function (envelope) {
    this._socket.outbox.push({
        module: 'conduit/window',
        method: 'envelope',
        previous: this._sequence,
        sequence: this._sequence = Monotonic.increment(this._sequence, 0),
        body: envelope
    })
    // When the nested stream ends, the underlying stream ends.
    if (envelope == null) {
        this._socket.outbox.push(null)
    }
}

module.exports = cadence(function (async, destructible, options) {
    return new Window(destructible, coalesce(options, {}))
})
