var util = require('util')

var cadence = require('cadence')

var Procession = require('procession')

var Cliffhanger = require('cliffhanger')

var interrupt = require('interrupt').createInterrupter('conduit')

var Basin = require('./basin')
var Spigot = require('./spigot')

function Requester (qualifier) {
    this._qualifier = qualifier
    this._cliffhanger = new Cliffhanger
    this.basin = new Basin(this)
    this.spigot = new Spigot(this)
}

Requester.prototype.request = cadence(function (async, qualifier, body) {
    if (this.spigot.requests.endOfStream) {
        Procession.raiseEndOfStream()
    } else {
        this.spigot.requests.enqueue({
            module: 'conduit',
            to: qualifier,
            from: this._qualifier,
            cookie: this._cliffhanger.invoke(async()),
            body: body
        }, async())
    }
})

Requester.prototype.fromSpigot = cadence(function (async, envelope) {
    switch (envelope.method) {
    case 'endOfStream':
    case 'error':
        this._cliffhanger.cancel(envelope.error)
        this.basin.responses.enqueue(envelope, async())
        this.spigot.requests.enqueue(envelope, async())
        break
    case 'entry':
        var envelope = envelope.body
        if (envelope.module == 'conduit' && envelope.to == this._qualifier) {
            this._cliffhanger.resolve(envelope.cookie, [ null, envelope.body ])
        } else {
            this.basin.responses.enqueue(envelope, async())
        }
        break
    }
})

Requester.prototype.fromBasin = function (envelope, callback) {
    this.spigot.requests.enqueue(envelope, callback)
}

module.exports = Requester
