require('proof/redux')(2, require('cadence')(prove))

function prove (async, assert) {
    var Multiplexer = require('../multiplexer')
    var Responder = require('../responder')
    var Requester = require('../requester')
    var stream = require('stream')
    var delta = require('delta')
    var abend = require('abend')
    var cadence = require('cadence')
    var input = new stream.PassThrough
    var output = new stream.PassThrough
    var requester = new Requester('requester')
    var responder = new Responder({
        request: cadence(function (async, value) {
            return value + 1
        })
    }, 'responder')
    var multiplexers = []
    async(function () {
        delta(async()).ee(input).on('readable')
        multiplexers.push(new Multiplexer(output, input))
        multiplexers[0].listen(abend)
        multiplexers[0].connect(async())
    }, function (socket) {
        var head = input.read()
        multiplexers.push(new Multiplexer(input, output, cadence(function (async, socket) {
            socket.spigot.emptyInto(responder.basin)
        })))
        multiplexers[1].listen(head, abend)
        async(function () {
            requester.spigot.emptyInto(socket.basin)
            requester.request('responder', 1, async())
        }, function (response) {
            assert(response, 2, 'round trip')
            multiplexers[1].destroy()
            multiplexers[0].destroy()
        }, function () {
            assert(multiplexers[0].destroyed && multiplexers[1].destroyed, 'destroyed')
        })
    })
}
