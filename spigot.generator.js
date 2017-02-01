var util = require('util')

var cadence = require('cadence')

var Procession = require('procession')
var Spigot = { Base: require('./spigot.base') }

var Cliffhanger = require('cliffhanger')

var interrupt = require('interrupt').createInterrupter('conduit')

function Generator () {
    this._cliffhanger = new Cliffhanger
    this.requests = new Procession
}
util.inherits(Generator, Spigot.Base)

Generator.prototype.request = cadence(function (async, body) {
    if (this.requests.endOfStream) {
        throw new interrupt('closed')
    } else {
        this.requests.enqueue({
            type: 'conduit',
            from: this._cliffhanger.invoke(async()),
            body: body
        }, async())
    }
})

Generator.prototype.send = cadence(function (async, body) {
    // TODO Should be able to enqueue as a noop after stream is closed.
    this.requests.enqueue({
        type: 'conduit',
        from: null,
        body: body
    }, async())
})

Generator.prototype.enqueue = cadence(function (async, envelope) {
    if (envelope == null) {
        envelope = interrupt('closed')
    }
    if (envelope instanceof Error) {
        this.requests.push(null)
        this._cliffhanger.cancel(envelope)
    } else {
        this._cliffhanger.resolve(envelope.to, [ null, envelope.body ])
    }
})

module.exports = Generator
