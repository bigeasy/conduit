require('proof')(1, async (okay) => {
    const Queue = require('avenue')

    const Destructible = require('destructible')
    const destructible = new Destructible('t/window.t.js')

    destructible.rescue2('test', async () => {
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

        console.log('here', queue.first.outbox.size)
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
    })

    await destructible.promise

    okay(true, 'done')
})
