require('proof')(6, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')

    var Client = require('../client')
    var Server = require('../server')

    var abend = require('abend')

    var Pump = require('procession/pump')

    var server = new Server(function (header) {
        okay(header, 1, 'header')
        var receiver = { read: new Procession, write: new Procession }
        var shifter = receiver.write.shifter()
        var pump = new Pump(shifter, function (envelope) {
            okay(envelope, 2, 'envelope')
            receiver.read.push(1)
            receiver.read.push(null)
            shifter.destroy()
        })
        pump.pump(abend)

        return receiver
    })
    server.listen(abend)

    var client = new Client
    client.listen(abend)

    new Pump(client.read.shifter(), server.write, 'enqueue').pump(abend)
    new Pump(server.read.shifter(), client.write, 'enqueue').pump(abend)

    var receiver = { read: new Procession, write: new Procession }
    var write = receiver.write.shifter()
    client.connect(1, receiver)
    receiver.read.push(2)

    client.write.push({})
    server.write.push({})

    okay(write.shift(), 1, 'server to client')
    receiver.read.push(null)

    okay(receiver.read.endOfStream && receiver.write.endOfStream, 'done')

    okay({
        client: Object.keys(client._sockets).length,
        server: Object.keys(server._sockets).length
    }, {
        client: 0,
        server: 0
    }, 'sockets gone')

    var server = new Server(function (header) {
        return { read: new Procession, write: new Procession }
    })

    var client = new Client

    new Pump(client.read.shifter(), server.write, 'enqueue').pump(abend)
    new Pump(server.read.shifter(), client.write, 'enqueue').pump(abend)

    client.connect(null, { read: new Procession, write: new Procession })

    client.write.push(null)
    server.write.push(null)

    okay({
        client: Object.keys(client._sockets).length,
        server: Object.keys(server._sockets).length
    }, {
        client: 0,
        server: 0
    }, 'sockets gone on null')
}
