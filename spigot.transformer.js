var util = require('util')
var cadence = require('cadence')
var Spigot = { Base: require('./spigot.base') }

function Transformer (object) {
    this._object = object
    Spigot.Base.call(this)
}
util.inherits(Transformer, Spigot.Base)

Transformer.prototype.enqueue = cadence(function (async, envelope) {
    async(function () {
        this._object.response(envelope, async())
    }, function (value) {
        this._object.basin.responses.enqueue(value, async())
    })
})

module.exports = Transformer
