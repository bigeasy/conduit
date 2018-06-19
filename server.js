// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

// Contextualized callbacks and event handlers.
var Operation = require('operation')

var Socket = require('./socket')

var assert = require('assert')
var abend = require('abend')

function Server (destructible, connect) {
    this._connect = connect

    this._sockets = {}

    this.outbox = new Procession
    this.inbox = new Procession

    this.inbox.pump(this, '_write', destructible.monitor('read'))

    this._destructible = destructible
}

Server.prototype._write = cadence(function (async, envelope) {
    if (envelope == null) {
        this.outbox = new Procession // acts as a null sink for any writes
        async.forEach(function (identifier) {
            this._sockets[identifier]._receive(null, async())
            delete this._sockets[identifier]
        })(Object.keys(this._sockets))
    } else if (
        envelope.module == 'conduit/client' &&
        envelope.method == 'connect'
    ) {
        async(function () {
            this._connect.call(null, envelope.body, async())
        }, function (receiver) {
            var socket = this._sockets[envelope.identifier] = new Socket(this, envelope.identifier, receiver)

            this._destructible.monitor([ 'socket', envelope.identifier ], true, socket, 'monitor', async())
        })
    } else if (
        envelope.module == 'conduit/socket' &&
        envelope.method == 'envelope'
    ) {
        this._sockets[envelope.identifier]._receive(envelope.body, async())
    }
})

module.exports = cadence(function (async, destructible) {
    return new Server(destructible, Operation(Array.prototype.slice.call(arguments, 2)))
})
