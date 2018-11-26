require('proof')(1, prove)

function prove (okay, callback) {
    var abend = require('abend')

    var Destructible = require('destructible')

    var destructible = {
        both: new Destructible(3000, 't/ping.t'),
        ping: new Destructible('t/ping.t/ping'),
        pong: new Destructible('t/ping.t/pong')
    }

    destructible.both.completed.wait(callback)

    destructible.ping.completed.wait(destructible.both.monitor('ping'))
    destructible.pong.completed.wait(destructible.both.monitor('pong'))

    var cadence = require('cadence')

    cadence(function (async) {
        var Procession = require('procession')

        var receivers = {
            ping: {
                inbox: new Procession,
                outbox: new Procession
            },
            pong: {
                inbox: new Procession,
                outbox: new Procession
            }
        }

        var shifters = {
            ping: receivers.ping.inbox.shifter(),
            pong: receivers.pong.inbox.shifter()
        }

        var Ping = require('../ping')
        var Pong = require('../pong')

        async(function () {
            destructible.ping.monitor('ping', Ping, receivers.ping, { timeout: 1000 }, async())
            destructible.pong.monitor('pong', Pong, receivers.pong, { timeout: 1000 }, async())
        }, function (ping, pong) {
            var pinger = ping.outbox.pump(pong.inbox, 'enqueue').run(abend)
            var ponger = pong.outbox.pump(ping.inbox, 'enqueue').run(abend)
            async(function () {
                setTimeout(async(), 500)
            }, function () {
                ping.stop()
                ping.stop()
                okay('okay')
                setTimeout(async(), 1500)
            }, function () {
                ping.inbox.push(null)
                pong.inbox.push(null)
                ping.outbox.push(null)
                pong.outbox.push(null)
            })
        })
    })(destructible.both.monitor('test'))
}
