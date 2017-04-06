require('proof')(5, require('cadence')(prove))

function prove (async, assert) {
    var Requester = require('../requester')
    var Procession = require('procession')
    var conduit = { write: new Procession, read: new Procession }
    var requester = new Requester('requester', conduit.read, conduit.write)
    var write = conduit.write.shifter()
    var read = requester.read.shifter()
    async(function () {
        async(function () {
            write.dequeue(async())
        }, function (envelope) {
            conduit.read.enqueue({
                module: 'conduit/responder',
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
            conduit.read.enqueue('to basin', async())
        }, function () {
            assert(read.shift(), 'to basin', 'forwarded')
        })
    }, function () {
        async(function () {
            requester.write.enqueue('from spigot', async())
        }, function () {
            assert(write.shift(), 'from spigot', 'backwarded')
        })
    }, function () {
        async(function () {
            write.dequeue(async())
        }, function (value) {
            conduit.read.enqueue(null, async())
        })
        async([function () {
            requester.request('responder', 1, async())
        }, function (error) {
            assert(error.interrupt, 'conduit#endOfStream', 'closed')
        }])
    }, [function () {
        requester.request('responder', 1, async())
    }, function (error) {
        assert(error.interrupt, 'conduit#endOfStream', 'still closed')
    }])
}
