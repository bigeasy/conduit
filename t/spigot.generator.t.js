require('proof/redux')(4, require('cadence')(prove))

function prove (async, assert) {
    var Spigot = { Generator: require('../spigot.generator') }
    var Procession = require('procession')
    var basin, generator = new Spigot.Generator
    var requests = generator.requests.shifter()
    async(function () {
        async(function () {
            requests.dequeue(async())
        }, function (envelope) {
            generator.enqueue({ to: envelope.from, body: envelope.body + 1 }, async())
        })
        async(function () {
            generator.request(1, async())
        }, function (value) {
            assert(value, 2, 'requested')
        })
    }, function () {
        async(function () {
            generator.send(1, async())
        }, function () {
            assert(requests.shift(), { type: 'conduit', from: null, body: 1 }, 'sent')
        })
    }, function () {
        async(function () {
            requests.dequeue(async())
        }, function (envelope) {
            generator.enqueue(null, async())
        })
        async([function () {
            generator.request(1, async())
        }, function (error) {
            assert(error.interrupt, 'procession#endOfStream', 'closed')
        }])
    }, [function () {
        generator.request(1, async())
    }, function (error) {
        assert(error.interrupt, 'procession#endOfStream', 'still closed')
    }])
}
