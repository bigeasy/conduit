require('proof')(4, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var Multiplexer = require('../multiplexer')

    var destructible = new Destructible('t/multiplexer.t.js')

    okay(Multiplexer, 'require')

    var receiver = {
        outbox: new Procession,
        inbox: new Procession,
        destroy: function () {
            this._callback.call()
        },
        monitor: function (destructible, callback) {
            destructible.destruct.wait(this, 'destroy')
            this._callback = destructible.monitor('monitor')
            callback()
        }
    }
    async(function () {
        destructible.monitor('multiplexer', Multiplexer, { x: receiver }, async())
    }, function (multiplexer) {
        destructible.completed.wait(async())

        var outbox = receiver.inbox.shifter()
        multiplexer.inbox.push({
            module: 'conduit/multiplexer',
            method: 'envelope',
            qualifier: 'x',
            body: 2
        })
        okay(outbox.shift(), 2, 'receive')
        var inbox = multiplexer.outbox.shifter()
        receiver.outbox.push(1)
        okay(inbox.shift(), {
            module: 'conduit/multiplexer',
            method: 'envelope',
            qualifier: 'x',
            body: 1
        }, 'send')
        multiplexer.inbox.push({})
        multiplexer.inbox.push(null)
        outbox.shift()
        okay(outbox.endOfStream, 'eos')
    })
}
