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
    var multiplexers = []
    async(function () {
        delta(async()).ee(input).on('readable')
        multiplexers.push(new Multiplexer(output, input))
        multiplexers[0].connect(async())
    }, function (socket) {
        var head = input.read()
        multiplexers.push(new Multiplexer(input, output, head, cadence(function (async, socket) {
            socket.spigot.emptyInto(basin)
        })))
        async(function () {
            spigot.emptyInto(socket.basin)
            spigot.request(1, async())
        }, function (response) {
            assert(response, 2, 'round trip')
            multiplexers[1].destroy()
            multiplexers[0].destroy()
        }, function () {
            assert(multiplexers[0].destroyed && multiplexers[1].destroyed, 'destroyed')
        })
    })
}
