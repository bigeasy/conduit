// Control-flow utilities.
var cadence = require('cadence')
var assert = require('assert')

// An evented message queue.
var Procession = require('procession')

// Evented stream reading and writing.
var Staccato = require('staccato')

// JSON for use in packets.
var Jacket = require('nascent.jacket')

// Orderly destruction of complicated objects.
var Destructible = require('destructible')

// Evented semaphore.
var Signal = require('signal')

// Return the first not null-like value.
var coalesce = require('extant')

// Once we get our hands on the `input` and `output` we own them, we're going to
// use `end` to indicate an end of stream. At the outset I'd hand a muddled
// imagining of external management of the stream, so that this interpretation
// of its contents was a "separate concern."

//
function Conduit (destructible, input, output, buffer, receiver) {
    this._input = new Staccato.Readable(input)

    this.destroyed = false

    this._output = new Staccato.Writable(output)

    this.receiver = receiver

    this._slices = []

    this._record = new Jacket

    this.eos = new Signal

    destructible.markDestroyed(this)

    this.receiver.outbox.pump(this, '_write', destructible.monitor('outbox'))

    this._consume(buffer, destructible.monitor('inbox'))
}

Conduit.prototype._consume = cadence(function (async, buffer) {
    async(function () {
        this._parse(coalesce(buffer, Buffer.alloc(0)), async())
    }, function () {
        this._read(async())
    }, function () {
        this.eos.wait(async())
    })
})

Conduit.prototype._buffer = cadence(function (async, buffer, start, end) {
    async(function () {
        var length = Math.min(buffer.length - start, this._chunk.length)
        var slice = buffer.slice(start, start + length)
        start += length
        this._chunk.length -= length
        // If chunk length is zero we have gathered up all of our chunks so
        // assemble them, but if not then save the slice for eventual assembly.

        //
        if (this._chunk.length === 0) {
            // If we've gathered slices, assemble them, otherwise make a copy of
            // the buffered slice (TODO what? but why? is it necessary?)
            if (this._slices.length == 0) {
                slice = Buffer.from(slice)
            } else {
                this._slices.push(slice)
                slice = Buffer.concat(this._slices)
                this._slices.length = 0
            }

            // The buffer body can be nested arbitrarily deep in envelopes.
            var envelope = this._chunk.body
            var e = envelope
            while (e.body != null) {
                e = e.body
            }
            e.body = slice

            // Reset to read next record.
            this._chunk = null
            this._record = new Jacket

            // Enqueue the parsed evelope.
            this.receiver.inbox.enqueue(envelope, async())
        } else {
            this._slices.push(Buffer.from(slice))
        }
    }, function () {
        return start
    })
})

Conduit.prototype._json = cadence(function (async, buffer, start, end) {
    start = this._record.parse(buffer, start, end)
    async(function () {
        if (this._record.object != null) {
            var envelope = this._record.object
            switch (envelope.method) {
            case 'envelope':
                this.receiver.inbox.enqueue(envelope.body, async())
                break
            case 'chunk':
                this._chunk = this._record.object
                break
            }
            this._record = new Jacket
        }
    }, function () {
        return start
    })
})

Conduit.prototype._parse = cadence(function (async, buffer) {
    var parse = async(function (start) {
        if (start == buffer.length) {
            return [ parse.break ]
        }
        if (this._chunk != null) {
            this._buffer(buffer, start, buffer.length, async())
        } else {
            this._json(buffer, start, buffer.length, async())
        }
    })(0)
})

Conduit.prototype._read = cadence(function (async) {
    var read = async(function () {
        this._input.read(async())
    }, function (buffer) {
        if (buffer == null) {
            this.receiver.inbox.push(null)
            this.eos.unlatch()
            return [ read.break ]
        }
        this._parse(buffer, async())
    })()
})

Conduit.prototype._write = cadence(function (async, envelope) {
    if (envelope == null) {
        this._output.end(async())
    } else {
        var e = envelope
        while (e.body != null && typeof e.body == 'object' && !Buffer.isBuffer(e.body)) {
            e = e.body
        }
        if (Buffer.isBuffer(e.body)) {
            var body = e.body
            e.body = null
            var packet = JSON.stringify({
                module: 'conduit',
                method: 'chunk',
                length: body.length,
                body: envelope
            }) + '\n'
            e.body = body
            this._output.write(packet, async())
            this._output.write(e.body, async())
        } else {
            this._output.write(JSON.stringify({
                module: 'conduit',
                method: 'envelope',
                body: envelope
            }) + '\n', async())
        }
    }
})

module.exports = cadence(function (async, destructible, input, output, receiver, buffer) {
    return new Conduit(destructible, input, output, buffer, receiver)
})
