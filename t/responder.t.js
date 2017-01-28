require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var Responder = require('../responder')
    var responder = new Responder({
        mapped: function (value, callback) {
            callback(null, value + 1)
        }
    }, {
        map: function () { return 'mapped' }
    })
    async(function () {
        responder.request(1, async())
    }, function (value) {
        assert(value, 2, 'mapped')
    })
}
