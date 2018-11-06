require('proof')(7, prove)

function prove (okay, callback) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var destructible = new Destructible('t/server.t.js')

    destructible.completed.wait(callback)

    var Client = require('../client')
    var Server = require('../server')

    var abend = require('abend')

    var visited = false

    var cadence = require('cadence')

    cadence(function (async) {
        async(function () {
            destructible.monitor('server', Server, cadence(function (async, header, inbox, outbox) {
                switch (header.method) {
                case 'call':
                    return [ 1 ]
                    break
                case 'stream':
                    async(function () {
                        inbox.dequeue(async())
                    }, function (value) {
                        okay(value, 1, 'received')
                        inbox.dequeue(async())
                    }, function (value) {
                        okay(value, null, 'received eos')
                        outbox.push(1)
                        outbox.push(null)
                    })
                    break
                case 'hangup':
                    async(function () {
                        inbox.dequeue(async())
                    }, function (value) {
                        okay(value, null, 'hungup server')
                    })
                    break
                }
            }), async())
            destructible.monitor('client', Client, async())
        }, function (server, client) {
            client.outbox.pump(server.inbox)
            server.outbox.pump(client.inbox)
            server.inbox.push({})
            client.inbox.push({})
            server.inbox.pump(function (envelope) { console.log('server', envelope) }, abend)
            client.inbox.pump(function (envelope) { console.log('client', envelope) }, abend)

            async(function () {
                client.connect({ method: 'call' }).inbox.dequeue(async())
            }, function (called) {
                okay(called, 1, 'called')
                // TODO Why not 'outbox' ??
                var request = client.connect({ method: 'stream', inbox: true, outbox: true })
                request.outbox.push(1)
                request.outbox.push(null)
                async(function () {
                    request.inbox.dequeue(async())
                }, function (value) { okay(value, 1, 'sent')
                    request.inbox.dequeue(async())
                }, function (value) {
                    okay(value, null, 'sent eos')
                })
            }, function () {
                var request = client.connect({ method: 'hangup', inbox: true, outbox: true })
                async(function () {
                    request.inbox.dequeue(async())
                    server.inbox.push(null)
                    client.inbox.push(null)
                }, function (value) {
                    okay(value, null, 'hungup client')
                })
            }, function () {
            })
        })
    })(destructible.monitor('test'))
}
