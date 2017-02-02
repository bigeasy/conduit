// Evented message queue.
var Procession = require('procession')

// Construct a Spigot that will forward requests to the `fromSpigot` method of the
// given delegate object.

//
function Spigot (delegate) {
    this._delegate = delegate
    this.requests = new Procession
    this.responses = new Procession
    this.responses.shifter().pump(this)
}

// Forward an enqueued message to the delegate.

//
Spigot.prototype.enqueue = function (envelope, callback) {
    this._delegate.fromSpigot(envelope, callback)
}

Spigot.prototype.emptyInto = function (basin) {
    this.requests.shifter().pump(basin.requests)
    basin.responses.shifter().pump(this.responses)
}

// Export as constructor.
module.exports = Spigot
