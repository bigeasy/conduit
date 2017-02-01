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
            destroy: function (callback) {
                assert(arguments.length, 1, 'destroy end of stream')
                callback()
            }
        }
        delegate = new Delegate(object, 'enqueue')
        delegate.invoke(null, async())
    }, function () {
        object = {
            destroy: function (error, callback) {
                assert(error.message, 'badness', 'destroy error')
                callback()
            }
        }
        delegate = new Delegate(object, 'enqueue')
        delegate.invoke(new Error('badness'), async())
    })
}
