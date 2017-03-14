var util = require('util')

var cadence = require('cadence')

var Procession = require('procession')

var Cliffhanger = require('cliffhanger')

var interrupt = require('interrupt').createInterrupter('conduit')

function Requester (qualifier, read, write) {
    this._qualifier = qualifier
    this._cliffhanger = new Cliffhanger
    this.write = new Procession
    this.read = new Procession
    read.pump(this)
    this.write.pump(write)
}

Requester.prototype.request = cadence(function (async, qualifier, body) {
    if (this.write.endOfStream || this.read.endOfStream) {
        throw interrupt('endOfStream')
    } else {
        this.write.enqueue({
            module: 'conduit/requester',
            to: qualifier,
            from: this._qualifier,
            cookie: this._cliffhanger.invoke(async()),
            body: body
        }, async())
    }
})

Requester.prototype.enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        this._cliffhanger.cancel(interrupt('endOfStream'))
        this.read.enqueue(envelope, async())
    } else {
        if (
            envelope.module == 'conduit/responder' &&
            envelope.to == this._qualifier
        ) {
            this._cliffhanger.resolve(envelope.cookie, [ null, envelope.body ])
        } else {
            this.read.enqueue(envelope, async())
        }
    }
})

module.exports = Requester
