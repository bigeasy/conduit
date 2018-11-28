require('proof')(7, prove)

function prove (okay, callback) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var destructible = new Destructible('t/server.t.js')

    destructible.completed.wait(callback)

    var Conduit = require('../conduit')

    var abend = require('abend')

    var visited = false

    var cadence = require('cadence')

    var network = {
        server: {
            inbox: new Procession,
            outbox: new Procession
        },
        client: {
            inbox: new Procession,
            outbox: new Procession
        }
    }

    cadence(function (async) {
        async(function () {
            destructible.durable('server', Conduit, network.server.inbox, network.server.outbox, cadence(function (async, header, inbox, outbox) {
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
            destructible.durable('client', Conduit, network.client.inbox, network.client.outbox, null, async())
        }, function (server, client) {
            network.client.outbox.pump(network.server.inbox, 'enqueue').run(abend)
            network.server.outbox.pump(network.client.inbox, 'enqueue').run(abend)
            network.server.inbox.push({})
            network.client.inbox.push({})
            network.server.inbox.pump(function (envelope) { console.log('server', envelope) }).run(abend)
            network.client.inbox.pump(function (envelope) { console.log('client', envelope) }).run(abend)

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
                    network.server.inbox.push(null)
                    network.client.inbox.push(null)
                }, function (value) {
                    okay(value, null, 'hungup client')
                })
            }, function () {
                client._request({})
            })
        })
    })(destructible.durable('test'))
}
