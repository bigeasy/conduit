require('proof')(4, require('cadence')(prove))

function prove (async, okay) {
    var Conduit = require('..')
    var stream = require('stream')
    var abend = require('abend')
    var Procession = require('procession')

    var Destructible = require('destructible')
    var destructible = new Destructible('t/conduit.t.js')

    var first = {
        receiver: { read: new Procession, write: new Procession },
        input: new stream.PassThrough,
        output: new stream.PassThrough
    }
    var second = {
        receiver: { read: new Procession, write: new Procession },
        input: new stream.PassThrough,
        output: new stream.PassThrough
    }

    async(function () {
        destructible.monitor('first', Conduit, first.input, first.output, first.receiver, async())
    }, function (conduit) {
        first.conduit = conduit
    }, function () {
        destructible.monitor('second', Conduit, second.input, second.output, second.receiver, async())
    }, function (conduit) {
        second.conduit = conduit
    }, function () {
        var buffer = new Buffer('qwertyuiop')

        first.conduit.receiver.read.push({
            module: 'conduit',
            method: 'example',
            body: { body: buffer }
        })
        var buffer = first.output.read()

        var shifter = second.conduit.receiver.write.shifter()

        second.input.write(buffer.slice(0, 10))
        second.input.write(buffer.slice(10, 120))
        second.input.write(buffer.slice(120))

        var shifted = shifter.shift()
        shifted.body.body = shifted.body.body.toString()
        okay(shifted, {
            module: 'conduit', method: 'example',
            body: { body: 'qwertyuiop' }
        }, 'piecemeal')

        okay(shifter.shift(), null, 'empty')
        second.input.write(buffer)

        var shifted = shifter.shift()
        shifted.body.body = shifted.body.body.toString()
        okay(shifted, {
            module: 'conduit', method: 'example',
            body: { body: 'qwertyuiop' }
        }, 'full buffer')

        first.conduit.receiver.read.push(1)
        second.input.write(first.output.read())
        okay(shifter.shift(), 1, 'envelope')

        first.conduit.receiver.read.push(null)
        var input = first.output.read()
        second.input.write(input)


        first.conduit.receiver.read.push({})

        destructible.destruct.wait(async())
        destructible.destroy()
    })
}
