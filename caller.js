var util = require('util')

var cadence = require('cadence')

var Procession = require('procession')

var Cliffhanger = require('cliffhanger')

var interrupt = require('interrupt').createInterrupter('conduit')

function Caller () {
    this.write = new Procession
    this.read = new Procession

    this.write.shifter().pump(this, '_enqueue')

    this._cliffhanger = new Cliffhanger
}

Caller.prototype.invoke = cadence(function (async, body) {
    if (this.write.endOfStream || this.read.endOfStream) {
        throw interrupt('endOfStream')
    } else {
        this.read.push({
            module: 'conduit/caller',
            method: 'invoke',
            cookie: this._cliffhanger.invoke(async()),
            body: body
        })
    }
})

Caller.prototype._enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        this._cliffhanger.cancel(interrupt('endOfStream'))
        this.read.enqueue(envelope, async())
    } else if (
        envelope.module == 'conduit/procedure' &&
        envelope.method == 'invocation'
    ) {
        this._cliffhanger.resolve(envelope.cookie, [ null, envelope.body ])
    } else {
        this.read.enqueue(envelope, async())
    }
})

module.exports = Caller
