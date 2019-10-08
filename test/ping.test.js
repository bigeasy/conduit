require('proof')(1, prove)

async function prove (okay) {
    const Queue = require('avenue')
    const Destructible = require('destructible')

    const destructible = {
        ping: new Destructible(3000, [ 't/ping.t', 'ping' ]),
        pong: new Destructible(3000, [ 't/ping.t', 'pong' ])
    }

    const inbox = new Queue, outbox = new Queue, proxy = new Queue

    const Ping = require('../ping')
    const Pong = require('../pong')

    let broken = false
    const shifter = inbox.shifter()
    shifter.pump(entry => {
        if (!broken) {
            proxy.push(entry)
        }
    })
    const pong = new Pong(destructible.pong.durable('pong'), proxy.shifter(), outbox, { timeout: 500 })
    const ping = new Ping(destructible.ping.durable('ping'), outbox.shifter(), inbox, { timeout: 500 })

    await new Promise(resolve => setTimeout(resolve, 300))

    broken = true

    await destructible.ping.destructed
    await destructible.pong.destructed
    okay('destroyed')
}
