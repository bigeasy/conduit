require('proof')(1, async (okay) => {
    const Queue = require('avenue')

    const Destructible = require('destructible')
    const destructible = new Destructible('t/window.t.js')

    const queue = {
        first: { outbox: new Queue, inbox: new Queue },
        second: { outbox: new Queue, inbox: new Queue }
    }
    const shifter = {
        first: { outbox: queue.first.outbox.shifter(), inbox: queue.first.inbox.shifter() },
        second: { outbox: queue.second.outbox.shifter(), inbox: queue.second.inbox.shifter() }
    }

    const Window = require('../window')
    const window = {
        first: new Window(destructible.durable('first')),
        second: new Window(destructible.durable('first'), { window: 2 })
    }

    await window.first.connect(shifter.first.inbox, queue.first.outbox)
    await window.second.connect(shifter.second.inbox, queue.second.outbox)

    window.first.outbox.push(1)
    window.first.outbox.push(2)
    window.first.outbox.push(3)
    queue.second.inbox.push(await shifter.first.outbox.shift())
    queue.second.inbox.push(await shifter.first.outbox.shift())
    queue.second.inbox.push(await shifter.first.outbox.shift())

    queue.first.inbox.push(await shifter.second.outbox.shift())

    queue.first.inbox.push(null)
    await new Promise(resolve => setImmediate(resolve))
    queue.first = { outbox: new Queue, inbox: new Queue }
    shifter.first = { outbox: queue.first.outbox.shifter(), inbox: queue.first.inbox.shifter() }

    await window.first.connect(shifter.first.inbox, queue.first.outbox)

    queue.second.inbox.push(await shifter.first.outbox.shift())

    window.first.drain()
    queue.first.inbox.push(null)
    queue.second.inbox.push(null)
    await new Promise(resolve => setImmediate(resolve))
    window.second.drain()

    window.first.outbox.push(null)
    window.second.outbox.push(null)

    destructible.destroy()

    await destructible.destructed

    okay(true, 'done')

    return

    destructible.completed.wait(callback)

    var cadence = require('cadence')

    cadence(function (async) {
        async(function () {
            destructible.durable('first', Window, async())
            destructible.durable('second', Window, { window: 2 }, async())
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
        })
    })(destructible.durable('test'))
})
