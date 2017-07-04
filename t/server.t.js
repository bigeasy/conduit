require('proof')(4, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')

    var Client = require('../client')
    var Server = require('../server')

    var server = new Server(function (header) {
        okay(header, 1, 'header')
        var receiver = { read: new Procession, write: new Procession }
        var pump = receiver.write.shifter().pump(function (envelope) {
            okay(envelope, 2, 'envelope')
            receiver.read.push(1)
            receiver.read.push(null)
            pump.cancel()
        })
        return receiver
    })

    var client = new Client

    client.read.shifter().pump(server.write, 'enqueue')
    server.read.shifter().pump(client.write, 'enqueue')

    var receiver = { read: new Procession, write: new Procession }
    var write = receiver.write.shifter()
    client.connect(1, receiver)
    receiver.read.push(2)

    client.write.push({})
    server.write.push({})

    okay(write.shift(), 1, 'server to client')
    receiver.read.push(null)

    okay(receiver.read.endOfStream && receiver.write.endOfStream, 'done')

    var server = new Server(function (header) {
        return { read: new Procession, write: new Procession }
    })

    var client = new Client

    client.read.shifter().pump(server.write, 'enqueue')
    server.read.shifter().pump(client.write, 'enqueue')

    client.connect(null, { read: new Procession, write: new Procession })

    client.write.push(null)
    server.write.push(null)
}
