var Destructible = require('destructible')

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

Pumpable.prototype.stack = function (initializer, callback) {
    initializer.destructor(this, 'destroy')
    this._destructible.completed.wait(callback)
    initializer.ready()
}

Pumpable.prototype._pump = function (terminates, key, queue, object, method) {
    require('assert')(typeof terminates == 'boolean')
    var shifter = queue.shifter()
    var callback = terminates ? this._destructible.rescue(key) : this._destructible.monitor(key)
    new Pump(shifter, object, method).pump(callback)
    return this._destructible.destruct.wait(shifter, 'destroy')
}

module.exports = Pumpable
