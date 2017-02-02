var cadence = require('cadence')

function Dispatcher (object, mapper) {
    this._object = object
    this._mapper = mapper
}

Dispatcher.prototype.request = cadence(function (async, envelope) {
    this._object[this._mapper.map(envelope, this._object)](envelope, async())
})

module.exports = Dispatcher
