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

function Window (receiver, options) {
    options = coalesce(options, {})

    this.read = new Procession
    this.write = new Procession

    this.write.shifter().pump(this, '_read')

    this._receiver = receiver
    this._receiver.read.shifter().pump(this, '_write')

    this._queue = new Procession
    this._reservoir = this._queue.shifter()

    this._pumper = this._queue.shifter().pump(this.read, 'enqueue')

    this._received = '0'
    this._sequence = '0'

    this._window = coalesce(options.window, 64)

    this._flush = Monotonic.add('0', this._window)
}

// Input into window from outside.

//
Window.prototype._read = cadence(function (async, envelope) {
    if (envelope == null) {
        this._receiver.write.push(null)
    } else if (
        envelope.module == 'conduit/window'
    ) {
        switch (envelope.method) {
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
                this.read.push({
                    module: 'conduit/window',
                    method: 'flush',
                    sequence: this._window
                })
                this._flush = Monotonic.add(this._flush, this._window)
            }
            // Forward the body.
            this._receiver.write.enqueue(envelope.body, async())
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
    } else if (
        envelope.module == 'conduit' &&
        envelope.method == 'connect'
    ) {
        this._pumper.cancel()
        this._pumper = this._reservoir
        this._reservoir = this._pumper.shifter()
        this._pumper.pump(this.read, 'enqueue')
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

module.exports = Window
