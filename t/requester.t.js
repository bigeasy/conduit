require('proof')(4, require('cadence')(prove))

function prove (async, assert) {
    var Requester = require('../requester')
    var Procession = require('procession')

    var requester = new Requester

    var shifter = requester.read.shifter()

    requester.request(1, function (error, result) {
        assert(result, 2, 'request')
    })

    assert(shifter.shift(), {
        module: 'conduit/requester',
        method: 'request',
        cookie: '1',
        body: 1
    }, 'request envelope')

    requester.write.push({})
    requester.write.push({
        module: 'conduit/responder',
        method: 'response',
        cookie: '1',
        body: 2
    })

    requester.request(1, function (error) {
        assert(/^conduit#endOfStream$/m.test(error.message), 'response eos')
    })

    requester.write.push(null)

    requester.request(1, function (error) {
        assert(/^conduit#endOfStream$/m.test(error.message), 'request eos')
    })
}
