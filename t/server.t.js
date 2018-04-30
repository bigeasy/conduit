require('proof')(5, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var destructible = new Destructible('t/server.t.js')

    var Client = require('../client')
    var Server = require('../server')

    var abend = require('abend')

    var visited = false

    async([function () {
        destructible.destroy()
    }], function () {
        destructible.monitor('server', Server, function (header, callback) {
            var receiver = { outbox: new Procession, inbox: new Procession }
            if (!visited) {
                visited = true
                okay(header, 1, 'header')
                var shifter = receiver.inbox.pump(function (envelope) {
                    okay(envelope, 2, 'envelope')
                    receiver.outbox.push(1)
                    receiver.outbox.push(null)
                    shifter.destroy()
                }, abend)
            }
            callback(null, receiver)
        }, async())
        destructible.monitor('client', Client, async())
    }, function (server, client) {
        client.outbox.pump(server.inbox)
        server.outbox.pump(client.inbox)
        server.inbox.pump(function (envelope) {
            console.log('zz', envelope)
        }, abend)

        var receiver = { outbox: new Procession, inbox: new Procession }
        var inbox = receiver.inbox.shifter()
        async(function () {
            client.connect(receiver, 1, async())
        }, function () {
            receiver.outbox.push(2)

            client.inbox.push({})
            server.inbox.push({})

            okay(inbox.shift(), 1, 'server to client')
            receiver.outbox.push(null)

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
                client.connect({ outbox: new Procession, inbox: new Procession }, null, async())
            }, function () {
                console.log('connected again')
                client.inbox.push(null)
                server.inbox.push(null)

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
