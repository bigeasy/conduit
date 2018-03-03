require('proof')(6, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var destructible = new Destructible('t/server.t.js')

    var Client = require('../client')
    var Server = require('../server')

    var abend = require('abend')

    var Pump = require('procession/pump')

    var visited = false

    async([function () {
        destructible.destroy()
    }], function () {
        destructible.monitor('server', Server, function (header, callback) {
            var receiver = { read: new Procession, write: new Procession }
            if (!visited) {
                visited = true
                okay(header, 1, 'header')
                var shifter = receiver.write.shifter()
                var pump = new Pump(shifter, function (envelope) {
                    okay(envelope, 2, 'envelope')
                    receiver.read.push(1)
                    receiver.read.push(null)
                    shifter.destroy()
                })
                pump.pumpify(abend)
            }
            callback(null, receiver)
        }, async())
        destructible.monitor('client', Client, async())
    }, function (server, client) {
        client.read.shifter().pumpify(server.write)
        server.read.shifter().pumpify(client.write)
        var Pump = require('procession/pump')
        new Pump(server.write.shifter(), function (envelope) {
            console.log('zz', envelope)
        }).pumpify(function () {})

        var receiver = { read: new Procession, write: new Procession }
        var write = receiver.write.shifter()
        async(function () {
            client.connect(receiver, 1, async())
        }, function () {
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
        }, function () {
            async(function () {
                console.log('connecting again')
                client.connect({ read: new Procession, write: new Procession }, null, async())
            }, function () {
                console.log('connected again')
                client.write.push(null)
                server.write.push(null)

                okay({
                    client: Object.keys(client._sockets).length,
                    server: Object.keys(server._sockets).length
                }, {
                    client: 0,
                    server: 0
                }, 'sockets gone on null')
            })
        })
    })
}
