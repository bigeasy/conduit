require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var Spigot = { Transformer: require('../spigot.transformer') }
    var Procession = require('procession')
    var basin, transformer = new Spigot.Transformer({
        response: function (value, callback) { callback(null, value + 1) },
        basin: basin = { responses: new Procession }
    })
    var responses = basin.responses.shifter()
    async(function () {
        transformer.enqueue(1, async())
    }, function () {
        assert(responses.shift(), 2, 'transformer transformed')
    })
}
