require('proof/redux')(5, require('cadence')(prove))

function prove (async, assert) {
    var Responder = require('../responder')
    var responder = new Responder({
        request: function (value, callback) {
            callback(null, value + 1)
        }
    }, 'responder')
    var responses = responder.basin.responses.shifter()
    var requests = responder.spigot.requests.shifter()
    async(function () {
        responder.basin.requests.enqueue({
            module: 'conduit',
            to: 'responder',
            from: 'requester',
            cookie: '1',
            body: 1
        }, async())
    }, function () {
        assert(responses.shift(), {
            module: 'conduit',
            to: 'requester',
            from: 'responder',
            cookie: '1',
            body: 2
        }, 'responder responded')
    }, function () {
        responder.basin.requests.enqueue(1, async())
    }, function () {
        assert(requests.shift(), 1, 'responder forwarded')
        responder.spigot.responses.enqueue(3, async())
    }, function () {
        assert(responses.shift(), 3, 'responder backwarded')
    }, function () {
        responder.basin.requests.enqueue(null, async())
    }, function () {
        assert(responses.shift(), null, 'basin closed')
        assert(requests.shift(), null, 'spigot closed')
    })
}
