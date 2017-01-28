var cadence = require('cadence')
var Procesion = require('procession')

function Transformer (object) {
    this._object = object
    this.responses = new Procesion
}

Transformer.prototype.enqueue = cadence(function (async, value) {
    async(function () {
        this._object.request(value, async())
    }, function (value) {
        this._object.spigot.requests.enqueue(value, async())
    })
})

module.exports = Transformer
