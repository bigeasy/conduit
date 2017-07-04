var util = require('util')

var cadence = require('cadence')

var Procession = require('procession')

var Cliffhanger = require('cliffhanger')

var interrupt = require('interrupt').createInterrupter('conduit')

function Requester () {
    this.write = new Procession
    this.read = new Procession

    this.write.shifter().pump(this, '_enqueue')

    this._cliffhanger = new Cliffhanger
}

Requester.prototype.request = cadence(function (async, body) {
    if (this.write.endOfStream || this.read.endOfStream) {
        throw interrupt('endOfStream')
    } else {
        this.read.push({
            module: 'conduit/requester',
            method: 'request',
            cookie: this._cliffhanger.invoke(async()),
            body: body
        })
    }
})

Requester.prototype._enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        this._cliffhanger.cancel(interrupt('endOfStream'))
        this.read.enqueue(envelope, async())
    } else if (
        envelope.module == 'conduit/responder' &&
        envelope.to == this._qualifier
    ) {
        this._cliffhanger.resolve(envelope.cookie, [ null, envelope.body ])
    } else {
        this.read.enqueue(envelope, async())
    }
})

module.exports = Requester
