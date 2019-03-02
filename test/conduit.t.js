require('proof')(6, prove)

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
                    // Trigger a hangup as a response to pushing something into
                    // a nested outbox. Edge case, see below.
                    setTimeout(function () { outbox.push({ outboxy: true }) }, 250)
                    // Note that we're doing nothing with the `inbox`, we're
                    // going to test hanging up on it.
                    break
                }
            }), async())
            destructible.durable('client', Conduit, network.client.inbox, network.client.outbox, null, async())
        }, function (server, client) {
            network.client.outbox.pump(network.server.inbox, 'enqueue').run(abend)
            network.server.outbox.pump(network.client.inbox, 'enqueue').run(abend)
            // This was hard to test. This the case when we shutdown in response
            // to end-of-stream on our inbox where the outbox gets an
            // end-of-stream explictly, externally while we're waiting for the
            // nested end-of-stream of a nested outbox to be written to the
            // outbox. The nested stream end-of-stream write and the outbox scan
            // for the nested end-of-stream are synchronous except in the case
            // where the Conduit inbox is terminated as a result of processing
            // an outgoing message on the nested outbox, that is, if the nested
            // outbox is waiting on a callback pushing the `null` that indicates
            // end-of-stream will not be processed until the callback returns.
            // If `null` is pushed onto the Conduit's outbox externally while
            // the nested outbox is waiting for this callback, then the scan
            // that looks for the nested end-of-stream message will return
            // early. We'll then trigger an assertion because we assert that all
            // the nested outboxes are closed as a final step of processing an
            // end-of-stream incoming to the Conduit.
            network.server.outbox.pump(function (envelope) {
                if (envelope && envelope.body && envelope.body.outboxy) {
                    network.server.inbox.end()
                    network.server.outbox.end()
                }
            }).run(abend)
            network.server.inbox.push({})
            network.client.inbox.push({})
            //network.server.inbox.pump(function (envelope) { console.log('server', envelope) }).run(abend)
            //network.client.inbox.pump(function (envelope) { console.log('client', envelope) }).run(abend)

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
                    request.outbox.push({ pusher: true })
                }, function () {
                    request.inbox.dequeue(async())
                }, function (value) {
                    okay(value, { outboxy: true }, 'hungup client')
                })
            })
        })
    })(destructible.durable('test'))
}
