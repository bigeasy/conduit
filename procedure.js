// Control-flow utility.
var cadence = require('cadence')

// Evented message queue.
var Procession = require('procession')
var coalesce = require('extant')

// Contextualized callbacks and event handlers.
var Operation = require('operation')

function Procedure (destructible, vargs) {
    this.destroyed = false
    destructible.markDestroyed(this)

    this._operation = new Operation(vargs)

    this.inbox = new Procession
    this.outbox = new Procession

    this.inbox.pump(this, '_enqueue', destructible.monitor('pump'))
}

Procedure.prototype._enqueue = cadence(function (async, envelope) {
    if (
        envelope != null &&
        envelope.module == 'conduit/caller' &&
        envelope.method == 'invoke'
    ) {
        async(function () {
            this._operation.call(null, envelope.body, async())
        }, function (response) {
            this.outbox.enqueue({
                module: 'conduit/procedure',
                method: 'invocation',
                cookie: envelope.cookie,
                body: coalesce(response)
            }, async())
        })
    }
})

module.exports = cadence(function (async, destructible) {
    return new Procedure(destructible, Array.prototype.slice.call(arguments, 2))
})
