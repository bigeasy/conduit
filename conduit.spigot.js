// From the Node.js API.
var util = require('util')

var _Spigot = require('./spigot')
var Base = require('./conduit.base')

function Spigot () {
    this.spigot = new _Spigot(this)
}
util.inherits(Spigot, Base)

Conduit.prototype.fromSpigot = function (envelope, callback) {
    this._enqueue(envelope, 'basin', callback)
}

module.exports = Spigot
