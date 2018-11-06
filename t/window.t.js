require('proof')(1, prove)

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
            destructible.monitor('first', Window, nested.first, async())
            destructible.monitor('second', Window, nested.second, { window: 4 }, async())
        }, function (first, second) {
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
