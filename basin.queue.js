// Evented message queue.
var Procession = require('procession')

// Correctly invokes delegates accounting for errors and end of stream.
var Delegate = require('./delegate')

// Construct a Basin.Queue that will invoke the `enqueued` method of the given
// delegate object.

//
function Queue (delegate) {
    this._delegate = new Delegate(delegate, 'enqueue')
    this.responses = new Procession
}

// Enqueue a value into the underlying delegate.

//
Queue.prototype.enqueue = function (envelope, callback) {
    this._delegate.invoke(envelope, callback)
}

// Export as constructor.
module.exports = Queue
