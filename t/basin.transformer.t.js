require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var Basin = { Transformer: require('../basin.transformer') }
    var Procession = require('procession')
    var spigot, transformer = new Basin.Transformer({
        request: function (value, callback) { callback(null, value + 1) },
        spigot: spigot = { requests: new Procession }
    })
    var requests = spigot.requests.shifter()
    async(function () {
        transformer.enqueue(1, async())
    }, function () {
        assert(requests.shift(), 2, 'transformer transformed')
    })
}
