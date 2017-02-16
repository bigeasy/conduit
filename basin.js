// Evented message queue.
var Procession = require('procession')

// Construct a Basin that will forward requests to the `fromBasin` method of the
// given delegate object.

//
function Basin (delegate) {
    this._delegate = delegate
    this.responses = new Procession
    this.requests = new Procession
    this.requests.shifter().pump(this)
}

// Forward an enqueued message to the delegate.

//
Basin.prototype.enqueue = function (envelope, callback) {
    // TODO Maybe send `this`?
    this._delegate.fromBasin(envelope, callback)
}

// Export as constructor.
module.exports = Basin
