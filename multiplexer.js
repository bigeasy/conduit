var cadence = require('cadence')
var coalesce = require('nascent.coalesce')
var delta = require('delta')
var Staccato = require('staccato')
var Jacket = require('nascent.jacket')
var Socket = require('./socket')
var Monotonic = require('monotonic').asString
var Destructor = require('nascent.destructor')
var interrupt = require('interrupt').createInterrupter('conduit.muliplexer')

function Multiplexer (reactor, input, output) {
    this._reactor = reactor
    this._record = new Jacket
    this._output = new Staccato.Writable(output)
    this._input = new Staccato.Readable(input)
    this._sockets = {}
    this._identifier = '0'
    this._destructor = new Destructor(interrupt)
    this._destructor.addJanitor('unlisten', this._unlisten.bind(this))
    this._destructor.addJanitor('mark', this._destroyed.bind(this))
}

Multiplexer.prototype.listen = cadence(function (async, buffer) {
    async(function () {
        this._parse(coalesce(buffer, new Buffer(0)), async())
    }, function () {
        this._read(async())
    })
})

Multiplexer.prototype._destroyed = function () {
    this.destroyed = true
}

Multiplexer.prototype._unlisten = function () {
    this._output.destroy()
    this._input.destroy()
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
        this._output.write(JSON.stringify({ cookie: 'header', to: id, body: null }) + '\n', async())
    }, function () {
        return [ socket ]
    })
})

Multiplexer.prototype._buffer = cadence(function (async, buffer, start, end) {
    async(function () {
        var object = this._record.object
        var length = Math.min(buffer.length, object.length)
        var spigot = cartridge.value.spigot
        start += length
        this._record.object.length -= length
        this._sockets[this._chunk.to].basin.responses.enqueue({
            cookie: coalesce(this._chunk.body.cookie),
            to: coalesce(this._chunk.body.to),
            from: coalesce(this._chunk.body.from),
            body: buffer.slice(start, start + length)
        }, async())
    }, function () {
        if (this._record.object.length == 0) {
            this._record = new Jacket
            cartridge.remove()
            return [ start ]
        } else {
            cartridge.release()
            return [ async.break, start ]
        }
    })
})

Multiplexer.prototype._json = cadence(function (async, buffer, start, end) {
    start = this._record.parse(buffer, start, end)
    async(function () {
        if (this._record.object != null) {
            var envelope = this._record.object
            switch (envelope.cookie) {
            case 'header':
                var socket = new Socket(this, envelope.to, true)
                this._sockets[socket._serverKey] = socket
                this._reactor.connect(socket, async())
                break
            case 'envelope':
                var socket = this._sockets[envelope.to]
                var queue = socket._serverSide ? socket.spigot.requests : socket.basin.responses
                queue.enqueue(envelope.body, async())
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
