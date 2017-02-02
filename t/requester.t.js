require('proof/redux')(5, require('cadence')(prove))

function prove (async, assert) {
    var Requester = require('../requester')
    var Procession = require('procession')
    var requester = new Requester('requester')
    var requests = requester.spigot.requests.shifter()
    var responses = requester.basin.responses.shifter()
    async(function () {
        async(function () {
            requests.dequeue(async())
        }, function (envelope) {
            envelope = envelope.body
            requester.spigot.responses.enqueue({
                module: 'conduit',
                to: envelope.from,
                from: 'responder',
                cookie: envelope.cookie,
                body: envelope.body + 1
            }, async())
        })
        async(function () {
            requester.request('responder', 1, async())
        }, function (value) {
            assert(value, 2, 'requested')
        })
    }, function () {
        async(function () {
            requester.basin.requests.enqueue('to basin', async())
        }, function () {
            assert(requests.shift().body, 'to basin', 'forwarded')
        })
    }, function () {
        async(function () {
            requester.spigot.responses.enqueue('from spigot', async())
        }, function () {
            assert(responses.shift().body, 'from spigot', 'backwarded')
        })
    }, function () {
        async(function () {
            requests.dequeue(async())
        }, function (envelope) {
            requester.spigot.responses.enqueue(null, async())
        })
        async([function () {
            requester.request('responder', 1, async())
        }, function (error) {
            assert(error.interrupt, 'procession#endOfStream', 'closed')
        }])
    }, [function () {
        requester.request('responder', 1, async())
    }, function (error) {
        assert(error.interrupt, 'procession#endOfStream', 'still closed')
    }])
}
