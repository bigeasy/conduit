require('proof')(1, require('cadence')(prove))

function prove (async, okay) {
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

    destructible.completed.wait(async())

    async([function () {
        destructible.destroy()
    }], function () {
        destructible.monitor('first', Window, nested.first, async())
        destructible.monitor('second', Window, nested.second, { window: 4 }, async())
    }, function (first, second) {
        first.outbox.pump(second.inbox)
        second.outbox.pump(first.inbox)

        nested.first.outbox.push(1)
        okay(shifters.second.inbox.shift(), 1, 'first')

        first.inbox.push({ module: 'conduit', method: 'connect' })

        nested.first.outbox.push(2)
        nested.first.outbox.push(3)
        nested.first.outbox.push(4)

        first.inbox.push({})
        first.inbox.push({
            module: 'conduit/window',
            method: 'envelope',
            sequence: 'a',
            previous: '9'
        })

        nested.first.outbox.push(null)
        nested.second.outbox.push(null)
    })
}
