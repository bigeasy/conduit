require('proof')(5, prove)

function prove (okay, callback) {
    var abend = require('abend')

    var Procession = require('procession')
    var Destructible = require('destructible')

    var destructible = new Destructible('t/window.t.js')

    var nested = {
        first: { outbox: new Procession, inbox: new Procession },
        second: { outbox: new Procession, inbox: new Procession }
    }
    var shifters = {
        first: { outbox: nested.first.outbox.shifter(), inbox: nested.first.inbox.shifter() },
        second: { outbox: nested.second.outbox.shifter(), inbox: nested.second.inbox.shifter() }
    }
    var Window = require('../window')

    destructible.completed.wait(callback)

    var cadence = require('cadence')

    cadence(function (async) {
        async(function () {
            destructible.monitor('first', Window, async())
            destructible.monitor('second', Window, { window: 2 }, async())
        }, function (first, second) {
            var inboxes = {
                first: first.inbox.shifter(),
                second: second.inbox.shifter()
            }
            var network = {
                first: { inbox: new Procession, outbox: new Procession },
                second: { inbox: new Procession, outbox: new Procession }
            }

            network.first.shifter = network.first.outbox.shifter()
            network.second.shifter = network.second.outbox.shifter()

            first.connect(network.first.inbox.shifter(), network.first.outbox)
            second.connect(network.second.inbox.shifter(), network.second.outbox)

            var send = cadence(function (async, value) {
                async(function () {
                    first.outbox.push(value)
                    network.first.shifter.dequeue(async())
                }, function (envelope) {
                    inboxes.second.dequeue(async())
                    network.second.inbox.push(envelope)
                })
            })

            async(function () {
                network.first.inbox.push({}) // will ignore
                first.outbox.push(1)
                network.first.shifter.dequeue(async())
            }, function (envelope) {
                inboxes.second.dequeue(async())
                network.second.inbox.push(envelope)
            }, function (envelope) {
                okay(envelope, 1, 'through')
                var shifter = network.first.shifter
                network.first.outbox = new Procession
                network.first.inbox = new Procession
                network.first.shifter = network.first.outbox.shifter()
                first.connect(network.first.inbox.shifter(), network.first.outbox)
                shifter.dequeue(async())
            }, function (envelope) {
                okay(envelope, null, 'connect end outbox')
                network.first.shifter.dequeue(async())
            }, function (envelope) {
                okay(envelope, {
                    module: 'conduit/window',
                    method: 'envelope',
                    previous: '0',
                    sequence: '1',
                    body: 1
                }, 'connect replay')
                network.second.inbox.push(envelope)
                send(2, async())
            }, function (envelope) {
                okay(envelope, 2, 'through 2')
                network.second.shifter.dequeue(async())
            }, function (envelope) {
                network.first.inbox.push(envelope)
                first.outbox.push(null)
                network.first.shifter.dequeue(async())
            }, function (envelope) {
                inboxes.second.dequeue(async())
                network.second.inbox.push(envelope)
                network.second.inbox.push(null)
            }, function (envelope) {
                okay(envelope, null, 'eos')
                first.truncate()
                second.outbox.push(null)
            })

            return
            first.outbox.pump(second.inbox, 'enqueue').run(abend)
            second.outbox.pump(first.inbox, 'enqueue').run(abend)

            second.reconnect()

            nested.first.outbox.push(1)
            okay(shifters.second.inbox.shift(), 1, 'first')

            second.reconnect()

            nested.first.outbox.push(2)
            nested.first.outbox.push(3)
            nested.first.outbox.push(4)

            first.inbox.push(null)
            first.inbox.push({})
            first.inbox.push({
                module: 'conduit/window',
                method: 'envelope',
                sequence: 'a',
                previous: '9'
            })

            second.hangup()
            nested.first.outbox.push(null)
        })
    })(destructible.monitor('test'))
}
