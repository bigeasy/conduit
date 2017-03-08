var cadence = require('cadence')
var Monotonic = require('monotonic').asString
var Socket = require('./socket')
var Procession = require('procession')

function Client (qualifier, read, write) {
    this._identifier = '0'
    this._sockets = {}
    this._qualifier = qualifier
    this.write = new Procession
    this.read = new Procession
    read.pump(this)
    this.write.pump(write)
}

Client.prototype._connect = cadence(function (async, socket, envelope) {
    async(function () {
        this.write.enqueue(envelope, async())
    }, function () {
        return [ socket ]
    })
})

Client.prototype.connect = function (header, callback) {
    var identifier = this._identifier = Monotonic.increment(this._identifier, 0)
    var socket = this._sockets[identifier] = new Socket(this, identifier)
    var envelope = {
        module: 'conduit',
        method: 'socket',
        to: this._qualifier,
        body: {
            module: 'conduit',
            method: 'header',
            to: identifier,
            body: header
        }
    }
    if (arguments.length == 1) {
        this.write.push(envelope)
        return socket
    }
    this._connect(socket, envelope, callback)
}

Client.prototype.enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        this.read.enqueue(envelope, async())
    } else if (
        envelope.module == 'conduit' &&
        envelope.method == 'socket' &&
        envelope.to == this._qualifier
    ) {
        envelope = envelope.body
        var socket = this._sockets[envelope.to]
        async(function () {
            socket.read.enqueue(envelope.body, async())
        }, function () {
            if (socket.write.endOfStream && socket.read.endOfStream) {
                socket.destroy()
            }
        })
    } else {
        this.read.enqueue(envelope, async())
    }
})

module.exports = Client
