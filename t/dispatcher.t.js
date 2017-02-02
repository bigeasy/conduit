require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var Dispatcher = require('../dispatcher')
    var dispatcher = new Dispatcher({
        mapped: function (value, callback) {
            callback(null, value + 1)
        }
    }, {
        map: function () { return 'mapped' }
    })
    async(function () {
        dispatcher.request(1, async())
    }, function (value) {
        assert(value, 2, 'mapped')
    })
}
