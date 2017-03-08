require('proof/redux')(5, require('cadence')(prove))

function prove (async, assert) {
    var Responder = require('../responder')
    var Procession = require('procession')
    var conduit = { write: new Procession, read: new Procession }
    var responder = new Responder({
        request: function (value, callback) {
            callback(null, value + 1)
        }
    }, 'responder', conduit.read, conduit.write)
    var read = {
        conduit: conduit.write.shifter(),
        responder: responder.read.shifter()
    }
    async(function () {
        conduit.read.enqueue({
            module: 'conduit',
            to: 'responder',
            from: 'requester',
            cookie: '1',
            body: 1
        }, async())
    }, function () {
        assert(read.conduit.shift(), {
            module: 'conduit',
            to: 'requester',
            from: 'responder',
            cookie: '1',
            body: 2
        }, 'responder responded')
    }, function () {
        responder.write.enqueue(1, async())
    }, function () {
        assert(read.conduit.shift(), 1, 'responder forwarded')
        conduit.read.enqueue(3, async())
    }, function () {
        assert(read.responder.shift(), 3, 'responder backwarded')
    }, function () {
        responder.write.enqueue(null, async())
    }, function () {
        read.conduit.shift()
        assert(read.conduit.endOfStream, 'basin closed')
        conduit.read.enqueue(null, async())
    }, function () {
        read.responder.shift()
        assert(read.responder.endOfStream, 'responder closed')
    })
}
