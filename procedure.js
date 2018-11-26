// Control-flow utility.
var cadence = require('cadence')

// Evented message queue.
var Procession = require('procession')
var coalesce = require('extant')

// Contextualized callbacks and event handlers.
var operation = require('operation')

var Signal = require('signal')

function Procedure (destructible, vargs) {
    this.destroyed = false
    destructible.markDestroyed(this)

    this._operation = operation.shift(vargs)

    this.inbox = new Procession
    this.outbox = new Procession

    this.inbox.pump(this, '_enqueue').run(destructible.monitor('pump'))

    this.eos = new Signal
}

Procedure.prototype._enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        this.eos.unlatch()
    } else if (envelope.module == 'conduit/caller' && envelope.method == 'invoke') {
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
    var vargs = []
    vargs.push.apply(vargs, arguments)
    vargs.splice(0, 2)
    return new Procedure(destructible, vargs)
})
