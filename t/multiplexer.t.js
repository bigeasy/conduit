require('proof/redux')(2, require('cadence')(prove))

function prove (async, assert) {
    var Multiplexer = require('../multiplexer')
    var Basin = require('../basin')
    var Spigot = require('../spigot')
    var stream = require('stream')
    var delta = require('delta')
    var cadence = require('cadence')
    var input = new stream.PassThrough
    var output = new stream.PassThrough
    var spigot = new Spigot.Generator
    var basin = new Basin.Responder({
        request: cadence(function (async, value) {
            return value + 1
        })
    })
    var multiplexers = [new Multiplexer({
        connect: cadence(function (async, socket) {
            socket.spigot.emptyInto(basin)
        })
    }, input, output), new Multiplexer(null, output, input)]
    async(function () {
        delta(async()).ee(input).on('readable')
        multiplexers[1].connect(async())
    }, function (socket) {
        var buffer = input.read()
        multiplexers[0].listen(buffer, async())
        multiplexers[1].listen(async())
        async(function () {
            spigot.emptyInto(socket.basin)
            spigot.request(1, async())
        }, function (response) {
            assert(response, 2, 'round trip')
            multiplexers[0].destroy()
            multiplexers[1].destroy()
        }, function () {
            assert(multiplexers[0].destroyed, 'destroyed')
        })
    })
}
