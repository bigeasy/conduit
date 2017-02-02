// Control-flow utility.
var cadence = require('cadence')

// Evented message queue.
var Procesion = require('procession')
var coalesce = require('nascent.coalesce')

function Responder (delegate) {
    this._delegate = delegate
    this.responses = new Procesion
    this.requests = new Procesion
    this.requests.pump(this)
}

Responder.prototype.enqueue = cadence(function (async, envelope) {
    switch (envelope.method) {
    case 'endOfStream':
        this.responses.enqueue(null, async())
        break
    case 'error':
        this.responses.enqueue(envelope.body, async())
        break
    case 'entry':
        envelope = envelope.body
        async(function () {
            this._delegate.request(envelope.body, async())
        }, function (response) {
            if (envelope.from != null) {
                this.responses.enqueue({
                    module: 'conduit',
                    to: envelope.from,
                    body: coalesce(response)
                }, async())
            }
        })
        break
    }
})

module.exports = Responder
