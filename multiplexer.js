// Utitlities common to my work.
var coalesce = require('nascent.coalesce')

// Control-flow utilities.
var abend = require('abend')
var delta = require('delta')
var cadence = require('cadence')

// Wrap a user specified callback.
var Operation = require('operation')

// Evented stream reading and writing.
var Staccato = require('staccato')

// JSON for use in packets.
var Jacket = require('nascent.jacket')

// Ever increasing serial value with no maximum value.
var Monotonic = require('monotonic').asString

// Orderly destruction of complicated objects.
var Destructor = require('nascent.destructor')

// Exceptions with context.
var interrupt = require('interrupt').createInterrupter('conduit')

// Our socket implementation.
var Socket = require('./socket')

// Create a Multiplexer with the given input and output streams that invoked the
// the connect operation when a new socket is created

//
function Multiplexer (input, output, connect) {
    this._connect = connect == null ? null : new Operation(connect)
    this._record = new Jacket
    this._output = new Staccato.Writable(output)
    this._input = new Staccato.Readable(input)
    this._endable = output
    this._sockets = {}
    this._identifier = '0'
    this._destructor = new Destructor(interrupt)
    this._destructor.addJanitor('shutdown', this._shutdown.bind(this))
    this._destructor.addJanitor('mark', this._destroyed.bind(this))
}

Multiplexer.prototype.listen = cadence(function (async, buffer) {
    async([function () {
        async(function () {
            this._parse(coalesce(buffer, new Buffer(0)), async())
        }, function () {
            this._read(async())
        })
    }, function (error) {
        this._destructor.destroy(error)
        throw error
    }])
})

Multiplexer.prototype._destroyed = function () {
    this.destroyed = true
}

Multiplexer.prototype._shutdown = function () {
    this._output.destroy()
    this._input.destroy()
    this._endable.end()
    var error = interrupt('shutdown', coalesce(this._destructor.cause))
    for (var key in this._sockets) {
        var socket = this._sockets[key]
        socket.basin.requests.push(error)
        socket.spigot.responses.push(error)
        socket.basin.responses.push(error)
        socket.spigot.requests.push(error)
    }
}

Multiplexer.prototype.destroy = function () {
    this._destructor.destroy()
}

Multiplexer.prototype.connect = cadence(function (async) {
    var id = this._identifier = Monotonic.increment(this._identifier, 0)
    // TODO id is going to collide, value on each side, mark with creator?
    var socket = new Socket(this, id, false)
    this._sockets[socket._clientKey] = socket
    async(function () {
        this._output.write(JSON.stringify({
            module: 'conduit',
            method: 'header',
            to: id,
            body: null
        }) + '\n', async())
    }, function () {
        return [ socket ]
    })
})

Multiplexer.prototype._buffer = cadence(function (async, buffer, start, end) {
    async(function () {
        var length = Math.min(buffer.length, this._chunk.length)
        var slice = buffer.slice(start, start + length)
        start += length
        this._chunk.length -= length
        var socket = this._sockets[this._chunk.to]
        var queue = this._chunk.outlet == 'spigot' ? socket.spigot.requests : socket.basin.responses
        var envelope = this._chunk.body
        if (this._chunk.length != 0) {
            envelope = JSON.parse(JSON.stringify(envelope))
        }
        envelope.body = slice
        queue.enqueue(envelope, async())
    }, function () {
        if (this._chunk.length == 0) {
            this._chunk = null
            this._record = new Jacket
        }
        return start
    })
})

Multiplexer.prototype._json = cadence(function (async, buffer, start, end) {
    start = this._record.parse(buffer, start, end)
    async(function () {
        if (this._record.object != null) {
            var envelope = this._record.object
            switch (envelope.method) {
            case 'header':
                var socket = new Socket(this, envelope.to, true)
                this._sockets[socket._serverKey] = socket
                // Not sure what to do in the case of these errors, no sockets
                // to send them through, so maybe we do just crash.
                this._connect.apply([ socket, async() ])
                break
            case 'envelope':
                var socket = this._sockets[envelope.to]
                var queue = envelope.outlet == 'spigot' ? socket.spigot.requests : socket.basin.responses
                queue.enqueue(envelope.body, async())
                break
            case 'chunk':
                this._chunk = this._record.object
                break
            case 'trailer':
                var socket = this._sockets[envelope.to]
                var queue = envelope.outlet == 'spigot' ? spigot.requests : socket.basin.responses
                queue.enqueue(null, async())
                delete this._sockets[envelope.to]
                break
            }
            this._record = new Jacket
        }
    }, function () {
        return start
    })
})

Multiplexer.prototype._parse = cadence(function (async, buffer) {
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

Multiplexer.prototype._read = cadence(function (async) {
    var read = async(function () {
        this._input.read(async())
    }, function (buffer) {
        if (buffer == null) {
            return [ read.break ]
        }
        this._parse(buffer, async())
    })()
})

module.exports = Multiplexer
