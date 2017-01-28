var cadence = require('cadence')
var Procesion = require('procession')
var coalesce = require('nascent.coalesce')

function Queue (object) {
    this._object = object
    this.responses = new Procesion
}

Queue.prototype.enqueue = cadence(function (async, envelope) {
    this._object.enqueue(envelope, async())
})

module.exports = Queue
