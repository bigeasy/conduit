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

// An error-frist callback work queue.
var Turnstile = require('turnstile/redux')
Turnstile.Queue = require('turnstile/queue')

function Conduit (input, output, receiver) {
    this.destroyed = false

    this._destructible = new Destructible('conduit/connection')
    this._destructible.markDestroyed(this)

    this._input = new Staccato.Readable(input)
    this._destructible.addDestructor('input', this._input, 'destroy')

    this._output = new Staccato.Writable(output)
    this._destructible.addDestructor('output', this._output, 'destroy')

    this._turnstile = new Turnstile
    this._queue = new Turnstile.Queue(this, '_write', this._turnstile)
    this._destructible.addDestructor('turnstile', this._turnstile, 'pause')

    this.receiver = receiver
    var pump = this.receiver.read.shifter().pump(this._queue, 'push')
    this._destructible.addDestructor('pump', pump, 'cancel')

    this._slices = []

    this._record = new Jacket

    this._closed = new Signal
    this._destructible.addDestructor('closed', this._closed, 'unlatch')

    this.ready = new Signal
    this._destructible.addDestructor('ready', this.ready, 'unlatch')
}

Conduit.prototype._pump = cadence(function (async, buffer) {
    async(function () {
        this._parse(coalesce(buffer, new Buffer(0)), async())
        this.ready.unlatch()
    }, function () {
        this._read(async())
    }, function () {
        this._closed.wait(async())
    })
})

Conduit.prototype._buffer = cadence(function (async, buffer, start, end) {
    async(function () {
        var length = Math.min(buffer.length - start, this._chunk.length)
        var slice = buffer.slice(start, start + length)
        start += length
        this._chunk.length -= length
        if (this._chunk.length == 0) {
            if (this._slices.length) {
                this._slices.push(slice)
                slice = Buffer.concat(this._slices)
                this._slices.length = 0
            } else {
                slice = new Buffer(slice)
            }
            var envelope = this._chunk.body
            var e = envelope
            while (e.body != null) {
                e = e.body
            }
            e.body = slice
            this._chunk = null
            this._record = new Jacket
            this.receiver.write.enqueue(envelope, async())
        } else {
            this._slices.push(new Buffer(slice))
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
                this.receiver.write.enqueue(envelope.body, async())
                break
            case 'chunk':
                this._chunk = this._record.object
                break
            case 'trailer':
                // var socket = this._sockets[envelope.to]
                this.receiver.write.enqueue(null, async())
                // delete this._sockets[envelope.to]
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
            return [ read.break ]
        }
        this._parse(buffer, async())
    })()
})

Conduit.prototype._write = cadence(function (async, envelope) {
    envelope = envelope.body
    async(function () {
        if (envelope == null) {
            // TODO And then destroy the conduit.
            this._output.write(JSON.stringify({
                module: 'conduit',
                method: 'trailer',
                body: null
            }) + '\n', async())
            this._closed.unlatch()
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
    }, function () {
        return []
    })
})

Conduit.prototype.listen = function (buffer, callback) {
    this.receiver.write.push({ module: 'conduit', method: 'connect' })
    this._queue.turnstile.listen(this._destructible.monitor('turnstile'))
    this._pump(buffer, this._destructible.monitor('pump'))
    this._destructible.completed.wait(callback)
}

Conduit.prototype.destroy = function () {
    this._destructible.destroy()
}

module.exports = Conduit
