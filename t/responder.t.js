require('proof')(1, require('cadence')(prove))

function prove (async, assert) {
    var Procession = require('procession')

    var Responder = require('../responder')


    var responder = new Responder({
        request: function (value, callback) {
            callback(null, value + 1)
        }
    })

    var shifter = responder.read.shifter()

    responder.write.push({})
    responder.write.push({
        module: 'conduit/requester',
        method: 'request',
        cookie: '1',
        body: 1
    })

    assert(shifter.shift(), {
        module: 'conduit/responder',
        method: 'response',
        cookie: '1',
        body: 2
    }, 'response')
}
