require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var Spigot = require('../spigot')
    var queue = new Spigot({
        fromSpigot: function (envelope, callback) {
            assert(envelope.body, 1, 'enqueued')
            callback()
        }
    })
    queue.responses.enqueue(1, async())
}
