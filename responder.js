// Control-flow utility.
var cadence = require('cadence')

// Evented message queue.
var Procesion = require('procession')
var coalesce = require('nascent.coalesce')

var Basin = require('./basin')
var Spigot = require('./spigot')

function Responder (delegate, qualifier) {
    this._qualifier = qualifier
    this._delegate = delegate
    this.basin = new Basin(this)
    this.spigot = new Spigot(this)
}

Responder.prototype.fromBasin = cadence(function (async, envelope) {
    switch (envelope.method) {
    case 'endOfStream':
    case 'error':
        this.basin.responses.enqueue(envelope, async())
        this.spigot.requests.enqueue(envelope, async())
        break
    case 'entry':
        envelope = envelope.body
        if (envelope.module == 'conduit' && envelope.to == this._qualifier) {
            async(function () {
                this._delegate.request(envelope.body, async())
            }, function (response) {
                this.basin.responses.enqueue({
                    module: 'conduit',
                    to: envelope.from,
                    from: this._qualifier,
                    cookie: envelope.cookie,
                    body: coalesce(response)
                }, async())
            })
        } else {
            this.spigot.requests.enqueue(envelope, async())
        }
        break
    }
})

Responder.prototype.fromSpigot = function (envelope, callback) {
    this.basin.responses.enqueue(envelope, callback)
}

module.exports = Responder
