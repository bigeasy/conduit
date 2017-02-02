// Evented message queue.
var Procession = require('procession')

// Construct a Basin.Queue that will invoke the `enqueued` method of the given
// delegate object.

//
function Queue (delegate) {
    this.responses = new Procession
    this.requests = new Procession
    this.requests.shifter().pump(delegate)
}

// Export as constructor.
module.exports = Queue
