var cadence = require('cadence')
var Spigot = { Queue: require('./spigot.queue') }
var Basin = { Queue: require('./basin.queue') }

function Contextualizer (socket, outlet) {
    this._socket = socket
    this._outlet = outlet
}

Contextualizer.prototype.enqueue = function (envelope, callback) {
    console.log('context')
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

Socket.prototype._shutdown = function (error) {
    this.basin.responses.push(error)
    this.spigot.requests.push(error)
}

Socket.prototype._enqueue = cadence(function (async, envelope, outlet) {
    var from = this._serverSide ? this._serverKey : this._clientKey
    var to = this._serverSide ? this._clientKey : this._serverKey
    console.log('>', envelope)
    async(function () {
        switch (envelope.method) {
        case 'endOfStream':
            this._multiplexer._output.write(JSON.stringify({
                module: 'conduit',
                method: 'trailer',
                to: to,
                outlet: outlet,
                body: null
            }) + '\n', async())
            break
        case 'error':
            if (!/^conduit#shutdown$/m.test(envelope.body.message)) {
                this._multiplexer._output.write(JSON.stringify({
                    module: 'conduit',
                    method: 'hangup',
                    to: to,
                    outlet: outlet,
                    body: null
                }) + '\n', async())
            }
            break
        case 'entry':
            envelope = envelope.body
            if (Buffer.isBuffer(envelope.body)) {
                var body = envelope.body
                envelope.body = null
                var packet = JSON.stringify({
                    module: 'conduit',
                    method: 'chunk',
                    to: to,
                    outlet: outlet,
                    length: body.length,
                    body: envelope
                }) + '\n'
                envelope.body = body
                this._multiplexer._output.write(packet, async())
                this._multiplexer._output.write(envelope.body, async())
            } else {
                console.log(':', envelope)
                this._multiplexer._output.write(JSON.stringify({
                    module: 'conduit',
                    method: 'envelope',
                    to: to,
                    outlet: outlet,
                    body: envelope
                }) + '\n', async())
            }
            break
        }
    }, function () {
        return []
    })
})

module.exports = Socket
