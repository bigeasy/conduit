var cadence = require('cadence')
var Procession = require('procession')

// Utilities.
var coalesce = require('extant')

// Evented stream reading and writing.
var Staccato = require('staccato')

// JSON for use in packets.
var Jacket = require('nascent.jacket')

// Ever increasing serial value with no maximum value.
var Monotonic = require('monotonic').asString

// Orderly destruction of complicated objects.
var Destructible = require('destructible')

var Signal = require('signal')

function Conduit (input, output) {
    this._destructible = new Destructible('conduit')
    this._destructible.markDestroyed(this)
    this.destroyed = false
    this._input = new Staccato.Readable(input)
    this._destructible.addDestructor('input', this._input, 'destroy')
    this._output = new Staccato.Writable(output)
    this._destructible.addDestructor('output', this._output, 'destroy')
    this.read = new Procession
    this.write = new Procession
    this.wrote = new Procession
    this.write.pump(this, 'enqueue')
    this._record = new Jacket
    this._closed = new Signal
    this._destructible.addDestructor('closed', this._closed, 'unlatch')
    this.ready = new Signal
    this._destructible.addDestructor('ready', this.ready, 'unlatch')
}

Conduit.prototype.enqueue = cadence(function (async, envelope) {
    if (this.destroyed) {
        return []
    }
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
        this.wrote.enqueue(envelope, async())
    }, function () {
        return []
    })
})

Conduit.prototype._listen = cadence(function (async, buffer) {
    async(function () {
        this._parse(coalesce(buffer, new Buffer(0)), async())
        this.ready.unlatch()
    }, function () {
        this._read(async())
    }, function () {
        this._closed.wait(async())
    })
})

Conduit.prototype.listen = cadence(function (async, buffer) {
    this._destructible.addDestructor('shutdown', this, '_shutdown')
    this._listen(buffer, this._destructible.monitor('listen'))
    this._destructible.completed(async())
})

Conduit.prototype._shutdown = function () {
    this.read.push(null)
}

Conduit.prototype.destroy = function () {
    this._destructible.destroy()
}

Conduit.prototype._buffer = cadence(function (async, buffer, start, end) {
    async(function () {
        var length = Math.min(buffer.length, this._chunk.length)
        var slice = buffer.slice(start, start + length)
        start += length
        this._chunk.length -= length
        var envelope = this._chunk.body
        if (this._chunk.length != 0) {
            envelope = JSON.parse(JSON.stringify(envelope))
        }
        var e = envelope
        while (e.body != null) {
            e = e.body
        }
        e.body = slice
        this.read.enqueue(envelope, async())
    }, function () {
        if (this._chunk.length == 0) {
            this._chunk = null
            this._record = new Jacket
        }
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
                this.read.enqueue(envelope.body, async())
                break
            case 'chunk':
                this._chunk = this._record.object
                break
            case 'trailer':
                // var socket = this._sockets[envelope.to]
                this.read.enqueue(null, async())
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

module.exports = Conduit
