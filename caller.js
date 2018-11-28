var util = require('util')

var cadence = require('cadence')

var Procession = require('procession')

var Cliffhanger = require('cliffhanger')

var Interrupt = require('interrupt').createInterrupter('conduit')

var Destructible = require('destructible')

var cadence = require('cadence')

var Signal = require('signal')

function Caller (destructible) {
    this.destroyed = false
    this.inbox = new Procession
    this.outbox = new Procession
    this._cliffhanger = new Cliffhanger
    this._destructible = destructible
    this._destructible.markDestroyed(this)
    this.eos = new Signal
}

Caller.prototype.monitor = cadence(function (async) {
    this.inbox.pump(this, '_enqueue').run(this._destructible.durable('pump'))
    return [ this ]
})

Caller.prototype.invoke = cadence(function (async, body) {
    if (this.eos.open == null) {
        this.outbox.push({
            module: 'conduit/caller',
            method: 'invoke',
            cookie: this._cliffhanger.invoke(async()),
            body: body
        })
    } else {
        throw new Interrupt('endOfStream')
    }
})

Caller.prototype._enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        this.eos.unlatch()
        this._cliffhanger.cancel(new Interrupt('endOfStream'))
        this.outbox.enqueue(envelope, async())
    } else if (
        envelope.module == 'conduit/procedure' &&
        envelope.method == 'invocation'
    ) {
        this._cliffhanger.resolve(envelope.cookie, [ null, envelope.body ])
    } else {
        this.outbox.enqueue(envelope, async())
    }
})

module.exports = cadence(function (async, destructible) {
    new Caller(destructible).monitor(async())
})
