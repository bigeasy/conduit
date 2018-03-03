require('proof')(1, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var destructible = new Destructible('t/window.t.js')

    var nested = {
        first: { read: new Procession, write: new Procession },
        second: { read: new Procession, write: new Procession }
    }
    var shifters = {
        first: { read: nested.first.read.shifter(), write: nested.first.write.shifter() },
        second: { read: nested.second.read.shifter(), write: nested.second.write.shifter() }
    }
    var Window = require('../window')

    async(function () {
        destructible.monitor('first', Window, nested.first, async())
        destructible.monitor('second', Window, nested.second, { window: 4 }, async())
    }, function (first, second) {
        first.read.shifter().pumpify(second.write)
        second.read.shifter().pumpify(first.write)

        nested.first.read.push(1)
        okay(shifters.second.write.shift(), 1, 'first')

        first.write.push({ module: 'conduit', method: 'connect' })

        nested.first.read.push(2)
        nested.first.read.push(3)
        nested.first.read.push(4)

        first.write.push({})
        first.write.push({
            module: 'conduit/window',
            method: 'envelope',
            sequence: 'a',
            previous: '9'
        })

        nested.first.read.push(null)
        nested.second.read.push(null)

        destructible.completed.wait(async())
        destructible.destroy()
    })
}
