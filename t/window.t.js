require('proof')(1, prove)

function prove (assert) {
    var Procession = require('procession')
    var nested = {
        first: { read: new Procession, write: new Procession },
        second: { read: new Procession, write: new Procession }
    }
    var shifters = {
        first: { read: nested.first.read.shifter(), write: nested.first.write.shifter() },
        second: { read: nested.second.read.shifter(), write: nested.second.write.shifter() }
    }
    var Window = require('../window')
    var first = new Window(nested.first)
    var second = new Window(nested.second, { window: 4 })

    first.read.shifter().pump(second.write, 'enqueue')
    second.read.shifter().pump(first.write, 'enqueue')

    nested.first.read.push(1)
    assert(shifters.second.write.shift(), 1, 'first')

    first.write.push({ module: 'conduit', method: 'connect' })

    nested.first.read.push(2)
    nested.first.read.push(3)
    nested.first.read.push(4)

    first.write.push({})

    nested.first.read.push(null)
}
