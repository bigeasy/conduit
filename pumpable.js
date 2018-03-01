var Destructible = require('destructible')
var cadence = require('cadence')

var Pump = require('procession/pump')

function Pumpable (key) {
    this.destroyed = false
    this._destructible = new Destructible(key)
    this._destructible.markDestroyed(this)
}

Pumpable.prototype.listen = function (callback) {
    this._destructible.completed.wait(callback)
}

Pumpable.prototype.destroy = function () {
    this._destructible.destroy()
}

Pumpable.prototype.monitor = cadence(function (async, destructible) {
    destructible.destruct.wait(this, 'destroy')
    this._destructible.completed.wait(destructible.monitor('pump'))
})

Pumpable.prototype._pump = function (terminates, key, queue, object, method) {
    require('assert')(typeof terminates == 'boolean')
    var shifter = queue.shifter()
    new Pump(shifter, object, method).pumpify(this._destructible.monitor(key, terminates))
    return this._destructible.destruct.wait(shifter, 'destroy')
}

module.exports = Pumpable
