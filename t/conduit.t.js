require('proof')(4, require('cadence')(prove))

function prove (async, okay) {
    var Conduit = require('..')
    var stream = require('stream')
    var abend = require('abend')
    var Procession = require('procession')

    var Destructible = require('destructible')
    var destructible = new Destructible('t/conduit.t.js')

    var first = {
        receiver: { outbox: new Procession, inbox: new Procession },
        input: new stream.PassThrough,
        output: new stream.PassThrough
    }
    var second = {
        receiver: { outbox: new Procession, inbox: new Procession },
        input: new stream.PassThrough,
        output: new stream.PassThrough
    }

    destructible.completed.wait(async())

    var buffer = Buffer.from('qwertyuiop')
    var shifter
    async([function () {
        destructible.destroy()
    }], function () {
        destructible.monitor('first', true, Conduit, first.input, first.output, first.receiver, async())
    }, function (conduit) {
        first.conduit = conduit
    }, function () {
        destructible.monitor('second', true, Conduit, second.input, second.output, second.receiver, async())
    }, function (conduit) {
        second.conduit = conduit
    }, function () {
        first.conduit.receiver.outbox.push({
            module: 'conduit',
            method: 'example',
            body: { body: buffer }
        })
        buffer = first.output.read()

        shifter = second.conduit.receiver.inbox.shifter()

        second.input.write(buffer.slice(0, 10))
        setImmediate(async())
    }, function () {
        second.input.write(buffer.slice(10, 120))
        setImmediate(async())
    }, function () {
        second.input.write(buffer.slice(120))
        setImmediate(async())
    }, function () {
        shifter.dequeue(async())
    }, function (shifted) {
        shifted.body.body = shifted.body.body.toString()
        okay(shifted, {
            module: 'conduit', method: 'example',
            body: { body: 'qwertyuiop' }
        }, 'piecemeal')

        okay(shifter.shift(), null, 'empty')
        second.input.write(buffer)

        shifter.dequeue(async())
    }, function (shifted) {
        shifted.body.body = shifted.body.body.toString()
        okay(shifted, {
            module: 'conduit', method: 'example',
            body: { body: 'qwertyuiop' }
        }, 'full buffer')

        first.conduit.receiver.outbox.push(1)
        second.input.write(first.output.read())

        shifter.dequeue(async())
    }, function (shifted) {
        okay(shifted, 1, 'envelope')

        first.conduit.receiver.outbox.push(null)
        var input = first.output.read()
        second.input.write(input)
        setImmediate(async())
    }, function () {
        first.conduit.receiver.outbox.push({})
    })
}
