var cadence = require('cadence')
var Spigot = { Queue: require('./spigot.queue') }
var Basin = { Queue: require('./basin.queue') }

function Contextualizer (socket, outlet) {
    this._socket = socket
    this._outlet = outlet
}

Contextualizer.prototype.enqueue = function (envelope, callback) {
    this._socket._enqueue(envelope, this._outlet, callback)
}

function Socket (multiplexer, id, serverSide) {
    this._serverSide = serverSide
    this._serverKey = '[server](' + id + ')'
    this._clientKey = '[client](' + id + ')'
    this._multiplexer = multiplexer
    this._id = id
    this.spigot = new Spigot.Queue(new Contextualizer(this, 'basin'))
    this.basin = new Basin.Queue(new Contextualizer(this, 'spigot'))
}

Socket.prototype._enqueue = cadence(function (async, envelope, outlet) {
    var from = this._serverSide ? this._serverKey : this._clientKey
    var to = this._serverSide ? this._clientKey : this._serverKey
    async(function () {
        if (envelope == null) {
            this._multiplexer._output.write(JSON.stringify({
                module: 'conduit',
                type: 'trailer',
                to: to,
                outlet: outlet,
                body: null
            }) + '\n', async())
        } else if (Buffer.isBuffer(envelope.body)) {
            this._multiplexer._output.write(JSON.stringify({
                module: 'conduit',
                type: 'chunk',
                to: to,
                outlet: outlet,
                body: { length: envelope.body.length }
            }) + '\n', async())
            this._multiplexer._output.write(envelope.body)
        } else {
            this._multiplexer._output.write(JSON.stringify({
                module: 'conduit',
                type: 'envelope',
                to: to,
                outlet: outlet,
                body: envelope
            }) + '\n', async())
        }
    }, function () {
        return []
    })
})

module.exports = Socket
