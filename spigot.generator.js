var util = require('util')

var cadence = require('cadence')

var Procession = require('procession')
var Spigot = { Base: require('./spigot.base') }

var Cliffhanger = require('cliffhanger')

var interrupt = require('interrupt').createInterrupter('conduit')

function Generator () {
    Spigot.Base.call(this)
    this._cliffhanger = new Cliffhanger
    this.responses.shifter().pump(this)
}
util.inherits(Generator, Spigot.Base)

Generator.prototype.request = cadence(function (async, body) {
    if (this.requests.endOfStream) {
        Procession.raiseEndOfStream()
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
    async([function () {
        Procession.raiseError(envelope)
        Procession.raiseEndOfStream(envelope)
        this._cliffhanger.resolve(envelope.body.to, [ null, envelope.body.body ])
    }, function (error) {
        this._cliffhanger.cancel(error)
        this.requests.push(null)
    }])
})

module.exports = Generator
