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
    var Pump = require('procession/pump')
    var abend = require('abend')
    var Window = require('../window')
    var first = new Window(nested.first)
    first.listen(abend)
    var second = new Window(nested.second, { window: 4 })
    second.listen(abend)

    new Pump(first.read.shifter(), second.write, 'enqueue').pump(abend)
    new Pump(second.read.shifter(), first.write, 'enqueue').pump(abend)

    nested.first.read.push(1)
    assert(shifters.second.write.shift(), 1, 'first')

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
}
