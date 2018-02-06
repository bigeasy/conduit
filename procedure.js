// Control-flow utility.
var cadence = require('cadence')

// Evented message queue.
var Procession = require('procession')
var coalesce = require('extant')

// Contextualized callbacks and event handlers.
var Operation = require('operation/variadic')

var util = require('util')
var Pumpable = require('./pumpable')

function Procedure () {
    Pumpable.call(this, 'procedure')

    var vargs = Array.prototype.slice.call(arguments)
    this._operation = new Operation(vargs)

    this.write = new Procession
    this.read = new Procession

    this._pump(false, 'enqueue', this.write, this, '_enqueue')
}
util.inherits(Procedure, Pumpable)

Procedure.prototype._enqueue = cadence(function (async, envelope) {
    if (
        envelope != null &&
        envelope.module == 'conduit/caller' &&
        envelope.method == 'invoke'
    ) {
        async(function () {
            this._operation.call(null, envelope.body, async())
        }, function (response) {
            this.read.enqueue({
                module: 'conduit/procedure',
                method: 'invocation',
                cookie: envelope.cookie,
                body: coalesce(response)
            }, async())
        })
    }
})

module.exports = Procedure
