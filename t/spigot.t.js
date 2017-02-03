require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var Spigot = require('../spigot')
    var queue = new Spigot({
        fromSpigot: function (value, callback) {
            assert(value, 1, 'enqueued')
            callback()
        }
    })
    queue.responses.enqueue(1, async())
}
