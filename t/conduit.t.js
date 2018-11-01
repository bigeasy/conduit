require('proof')(8, prove)

function prove (okay, callback) {
    var Conduit = require('..')
    var stream = require('stream')
    var abend = require('abend')
    var Procession = require('procession')

    var delta = require('delta')

    var Destructible = require('destructible')
    var destructible = new Destructible('t/conduit.t.js')

    // Note that we split our duplex stream into four streams because we want to
    // simulate the network so we can test receving partial chunks.

    //
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

    destructible.completed.wait(callback)

    var cadence = require('cadence')

    cadence(function (async) {
        var buffer = Buffer.from('qwertyuiop')
        var shifter
        async([function () {
            destructible.destroy()
        }], function () {
            destructible.monitor('writer', true, Conduit, first.receiver, first.input, first.output, async())
        }, function (conduit) {
            first.conduit = conduit
        }, function () {
            destructible.monitor('reader', true, Conduit, second.receiver, second.input, second.output, async())
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

            delta(async()).ee(first.output).on('readable')
            first.conduit.receiver.outbox.push(null)
        }, function () {
            delta(async()).ee(first.output).on('end')
            okay(first.output.read(), null, 'first closed')
        }, function () {
            okay(true, 'first end')
            delta(async()).ee(second.output).on('readable')
            second.conduit.receiver.outbox.push(null)
        }, function () {
            delta(async()).ee(second.output).on('end')
            okay(second.output.read(), null, 'second closed')
        }, function () {
            okay(true, 'second end')
        }, function () {
            first.input.end()
            second.input.end()
            setImmediate(async())
        }, function () {
            first.conduit.receiver.outbox.push({})
            first.conduit.hangup()
        })
    })(destructible.monitor('test'))
}
