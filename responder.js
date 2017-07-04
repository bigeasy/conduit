// Control-flow utility.
var cadence = require('cadence')

// Evented message queue.
var Procession = require('procession')
var coalesce = require('extant')

function Responder (delegate) {
    this._delegate = delegate

    this.write = new Procession
    this.read = new Procession

    this.write.shifter().pump(this, '_enqueue')
}

Responder.prototype._enqueue = cadence(function (async, envelope) {
    if (
        envelope != null &&
        envelope.module == 'conduit/requester' &&
        envelope.method == 'request'
    ) {
        async(function () {
            this._delegate.request(envelope.body, async())
        }, function (response) {
            this.read.enqueue({
                module: 'conduit/responder',
                method: 'response',
                cookie: envelope.cookie,
                body: coalesce(response)
            }, async())
        })
    }
})

module.exports = Responder
