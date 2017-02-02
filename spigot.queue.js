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
    Spigot.Base.call(this)
    this.responses.shifter().pump(delegate)
}
util.inherits(Queue, Spigot.Base)

// Export as constructor.
module.exports = Queue
