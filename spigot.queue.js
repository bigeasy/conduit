// Common utilities.
var util = require('util')

// Base class for all Spigots.
var Spigot = { Base: require('./spigot.base') }

// Correctly invokes delegates accounting for errors and end of stream.
var Delegate = require('./delegate')

// Construct a Spigot.Queue that will invoke the `enqueued` method of the given
// delegate object.

//
function Queue (delegate) {
    this._delegate = new Delegate(delegate, 'enqueue')
    Spigot.Base.call(this)
}
util.inherits(Queue, Spigot.Base)

// Enqueue a value into the underlying delegate.

//
Queue.prototype.enqueue = function (envelope, callback) {
    this._delegate.invoke(envelope, callback)
}

// Export as constructor.
module.exports = Queue
