require('proof')(4, require('cadence')(prove))

function prove (async, assert) {
    var cadence = require('cadence')
    var Delegate = require('../delegate')
    var object = {
        enqueue: function (envelope, callback) { callback(null, 1) }
    }
    var delegate = new Delegate(object, 'enqueue')
    async(function () {
        delegate.invoke({}, async())
    }, function (response) {
        assert(response, 1, 'invoke')
        delegate.invoke(null, async())
    }, function () {
        assert(delegate.endOfStream, 'closed')
        delegate.invoke(null, async())
    }, function () {
        object = {
            destroy: function () {
                assert(arguments.length, 0, 'destroy end of stream')
            }
        }
        delegate = new Delegate(object, 'enqueue')
        delegate.invoke(null, async())
    }, function () {
        object = {
            destroy: function (error) {
                assert(error.message, 'badness', 'destroy error')
            }
        }
        delegate = new Delegate(object, 'enqueue')
        delegate.invoke(new Error('badness'), async())
    })
}
