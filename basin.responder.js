var cadence = require('cadence')
var Procesion = require('procession')
var coalesce = require('nascent.coalesce')

function Responder (object) {
    this._object = object
    this.responses = new Procesion
}

Responder.prototype.enqueue = cadence(function (async, envelope) {
    async(function () {
        var body = envelope
        while (typeof body == 'object' && body.type == 'conduit') {
            body = body.body
        }
        this._object.request(body, async())
    }, function (response) {
        if (envelope.from != null) {
            this.responses.enqueue({
                type: 'conduit',
                cookie: coalesce(envelope.cookie),
                to: envelope.from,
                body: coalesce(response)
            }, async())
        }
    })
})

module.exports = Responder
