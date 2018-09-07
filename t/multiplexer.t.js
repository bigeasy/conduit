require('proof')(5, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var Multiplexer = require('../multiplexer')

    var destructible = new Destructible('t/multiplexer.t.js')

    okay(Multiplexer, 'require')

    var receivers = {
        x: {
            outbox: new Procession,
            inbox: new Procession
        },
        y: {
            outbox: new Procession,
            inbox: new Procession
        }
    }
    async(function () {
        destructible.monitor('multiplexer', Multiplexer, receivers, async())
    }, function (multiplexer) {
        destructible.completed.wait(async())

        var outbox = receivers.x.inbox.shifter()
        multiplexer.inbox.push({
            module: 'conduit/multiplexer',
            method: 'envelope',
            qualifier: 'x',
            body: 2
        })
        okay(outbox.shift(), 2, 'receive')
        var inbox = multiplexer.outbox.shifter()
        receivers.x.outbox.push(1)
        okay(inbox.shift(), {
            module: 'conduit/multiplexer',
            method: 'envelope',
            qualifier: 'x',
            body: 1
        }, 'send')
        multiplexer.inbox.push({})
        multiplexer.inbox.push(null)
        outbox.shift()
        okay(outbox.endOfStream, 'inbox eos')
        receivers.y.outbox.push(null)
        receivers.x.outbox.push(null)
        inbox.shift()
        okay(inbox.endOfStream, 'outbox eos')
    })
}
