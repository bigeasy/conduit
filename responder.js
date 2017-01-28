var coalesce = require('nascent.coalesce')
var cadence = require('cadence')
var Procession = require('procession')

function Responder (object, mapper) {
    this._object = object
    this._mapper = mapper
}

Responder.prototype.request = cadence(function (async, envelope) {
    this._object[this._mapper.map(envelope, this._object)](envelope, async())
})

module.exports = Responder
