require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var Spigot = { Queue: require('../spigot.queue') }
    var queue = new Spigot.Queue({
        enqueue: function (envelope, callback) {
            assert(envelope, 1, 'enqueued')
            callback()
        }
    })
    queue.enqueue(1, async())
}
