// Control-flow utility.
var cadence = require('cadence')

// Evented message queue.
var Procession = require('procession')
var coalesce = require('extant')

function Responder (delegate, qualifier, read, write) {
    this._qualifier = qualifier
    this._delegate = delegate
    this.write = new Procession
    this.read = new Procession
    this.write.pump(write)
    read.pump(this)
}

Responder.prototype.enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        this.read.push(null)
    } else {
        if (
            envelope.module == 'conduit/requester' &&
            envelope.to == this._qualifier
        ) {
            async(function () {
                this._delegate.request(envelope.body, async())
            }, function (response) {
                this.write.enqueue({
                    module: 'conduit/responder',
                    to: envelope.from,
                    from: this._qualifier,
                    cookie: envelope.cookie,
                    body: coalesce(response)
                }, async())
            })
        } else {
            this.read.enqueue(envelope, async())
        }
    }
})

module.exports = Responder
