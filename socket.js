var cadence = require('cadence')
var Spigot = { Queue: require('./spigot.queue') }
var Basin = { Queue: require('./basin.queue') }

function Socket (multiplexer, id, serverSide) {
    this._serverSide = serverSide
    this._serverKey = '[server](' + id + ')'
    this._clientKey = '[client](' + id + ')'
    this._multiplexer = multiplexer
    this._id = id
    // TODO Server versus client?
    this.spigot = new Spigot.Queue(this)
    this.basin = new Basin.Queue(this)
}

Socket.prototype.enqueue = cadence(function (async, envelope) {
    var from = this._serverSide ? this._serverKey : this._clientKey
    var to = this._serverSide ? this._clientKey : this._serverKey
    async(function () {
        if (envelope == null) {
            this._multiplexer._output.write(JSON.stringify({
                cookie: 'trailer', to: to, body: null
            }) + '\n', async())
        } else if (Buffer.isBuffer(envelope.body)) {
            this._multiplexer._output.write(JSON.stringify({
                cookie: 'chunk', to: to, body: { length: envelope.body.length }
            }) + '\n', async())
            this._multiplexer._output.write(envelope.body)
        } else {
            this._multiplexer._output.write(JSON.stringify({
                cookie: 'envelope', to: to, body: envelope
            }) + '\n', async())
        }
    }, function () {
        return []
    })
})

module.exports = Socket
