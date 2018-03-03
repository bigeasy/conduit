require('proof')(4, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var Multiplexer = require('../multiplexer')

    var destructible = new Destructible('t/multiplexer.t.js')

    okay(Multiplexer, 'require')

    var receiver = {
        read: new Procession,
        write: new Procession,
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

        var read = receiver.write.shifter()
        multiplexer.write.push({
            module: 'conduit/multiplexer',
            method: 'envelope',
            qualifier: 'x',
            body: 2
        })
        okay(read.shift(), 2, 'receive')
        var write = multiplexer.read.shifter()
        receiver.read.push(1)
        okay(write.shift(), {
            module: 'conduit/multiplexer',
            method: 'envelope',
            qualifier: 'x',
            body: 1
        }, 'send')
        multiplexer.write.push({})
        multiplexer.write.push(null)
        read.shift()
        okay(read.endOfStream, 'eos')
    })
}
