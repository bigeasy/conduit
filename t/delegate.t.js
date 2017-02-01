require('proof')(2, require('cadence')(prove))

function prove (async, assert) {
    var cadence = require('cadence')
    var Delegate = require('../delegate')
    var object = {
        enqueue: function (envelope, callback) { callback(null, 1) }
    }
    var delegate = new Delegate(object)
    async(function () {
        delegate.enqueue({}, async())
    }, function (response) {
        assert(response, 1, 'invoke')
        delegate.enqueue(null, async())
    }, function () {
        assert(delegate.endOfStream, 'closed')
        delegate.enqueue(null, async())
    })
}
