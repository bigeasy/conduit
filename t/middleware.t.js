require('proof')(1, prove)

function prove (okay, callback) {
    var Procession = require('procession')

    var Conduit = require('../conduit')

    var Middleware = require('../middleware')
    var Requester = require('../requester')

    var abend = require('abend')

    var destroyer = require('server-destroy')

    var http = require('http')
    var Destructible = require('destructible')
    var UserAgent = require('vizsla')
    var ua = new UserAgent

    var destructible = new Destructible(1000, 't/middleware')

    destructible.completed.wait(callback)

    var cadence = require('cadence')
    var delta = require('delta')

    cadence(function (async) {
        async(function () {
            destructible.monitor('middleware', Middleware, function (request, response) {
                response.writeHead(200, { 'content-type': 'text/plain', connection: 'close' })
                response.end('hello, world')
            }, async())
        }, function (middleware) {
            var inbox = new Procession, outbox = new Procession
            destructible.destruct.wait(inbox, 'end')
            destructible.destruct.wait(outbox, 'end')
            destructible.monitor('client', Conduit, inbox, outbox, async())
            destructible.monitor('server', Conduit, outbox, inbox, cadence(function (async, header, inbox, outbox) {
                console.log(header)
                middleware.request(header, inbox, outbox)
            }), async())
        }, function (client, server, requester) {
            async(function () {
                destructible.monitor('requester', Requester, client, function () {}, async())
            }, function (requester) {
                server = http.createServer(function (request, response) {
                    requester.request(request, response)
                })
                destroyer(server)
                server.listen(8888, '127.0.0.1', async())
            }, function () {
                delta(destructible.monitor('http')).ee(server).on('close')
                destructible.destruct.wait(server, 'destroy')
                ua.fetch({
                    url: 'http://127.0.0.1:8888',
                    timeout: 4000,
                    parse: 'text'
                }, async())
            }, function (body, response) {
                okay(body, 'hello, world', 'index')
            })
        })
    })(destructible.monitor('test'))
}
