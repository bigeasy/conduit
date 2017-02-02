require('proof/redux')(2, require('cadence')(prove))

function prove (async, assert) {
    var Basin = { Responder: require('../basin.responder') }
    var responder = new Basin.Responder({
        request: function (value, callback) {
            callback(null, value + 1)
        }
    })
    var responses = responder.responses.shifter()
    async(function () {
        responder.requests.enqueue({ from: 'x', body: 1 }, async())
    }, function () {
        assert(responses.shift().body, {
            module: 'conduit', to: 'x', body: 2
        }, 'responder responded')
    }, function () {
        responder.enqueue({ body: 1 }, async())
    }, function () {
        assert(responses.shift(), null, 'responder swallowed')
    })
}
