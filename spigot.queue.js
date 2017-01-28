var util = require('util')
var cadence = require('cadence')
var Procession = require('procession')
var Cliffhanger = require('cliffhanger')
var Spigot = { Base: require('./spigot.base') }

function Queue (delegate) {
    this._delegate = delegate
    this.requests = new Procession
}
util.inherits(Queue, Spigot.Base)

Queue.prototype.enqueue = cadence(function (async, envelope) {
    this._delegate.enqueue(envelope, async())
})

module.exports = Queue
