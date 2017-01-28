var util = require('util')
var cadence = require('cadence')
var Procession = require('procession')
var Cliffhanger = require('cliffhanger')
var Spigot = { Base: require('./spigot.base') }

function Generator () {
    this._cliffhanger = new Cliffhanger
    this.requests = new Procession
}
util.inherits(Generator, Spigot.Base)

Generator.prototype.request = cadence(function (async, body) {
    this.requests.enqueue({
        type: 'conduit',
        from: this._cliffhanger.invoke(async()),
        body: body
    }, async())
})

Generator.prototype.send = cadence(function (async, body) {
    this.requests.enqueue({
        type: 'conduit',
        from: null,
        body: body
    }, async())
})

Generator.prototype.enqueue = cadence(function (async, envelope) {
    this._cliffhanger.resolve(envelope.to, [ null, envelope.body ])
})

module.exports = Generator
