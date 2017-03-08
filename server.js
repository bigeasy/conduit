var cadence = require('cadence')
var Monotonic = require('monotonic').asString
var Socket = require('./socket')
var Procession = require('procession')
var Operation = require('operation/redux')

function Server (connect, qualifier, read, write) {
    this._identifier = '0'
    this._sockets = {}
    this._qualifier = qualifier
    this._connect = Operation(connect)
    this.read = new Procession
    this.write = new Procession
    read.pump(this)
    this.write.pump(write)
}

Server.prototype.enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        this.read.enqueue(envelope, async())
    } else if (
        envelope.module == 'conduit' &&
        envelope.method == 'socket' &&
        envelope.to == this._qualifier
    ) {
        envelope = envelope.body
        switch (envelope.method) {
        case 'header':
            var socket = new Socket(this, envelope.to)
            this._sockets[envelope.to] = socket
            this._connect.call(null, socket, envelope.body)
            break
        case 'envelope':
            var socket = this._sockets[envelope.to]
            async(function () {
                socket.read.enqueue(envelope.body, async())
            }, function () {
                if (socket.write.endOfStream && socket.read.endOfStream) {
                    socket.destroy()
                }
            })
        }
    } else {
        this.read.enqueue(envelope, async())
    }
})

module.exports = Server
