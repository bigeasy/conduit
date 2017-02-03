require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var Basin = require('../basin')
    var queue = new Basin({
        fromBasin: function (value, callback) {
            assert(value, 1, 'enqueue')
            callback(null)
        }
    })
    queue.requests.enqueue(1, async())
}