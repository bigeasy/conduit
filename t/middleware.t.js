require('proof')(1, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')

    var Client = require('../client')
    var Server = require('../server')

    var Middleware = require('../middleware')
    var Requester = require('../requester')

    var abend = require('abend')

    var destroyer = require('server-destroy')

    var http = require('http')
    var Destructible = require('destructible')
    var UserAgent = require('vizsla')
    var ua = new UserAgent

    var destructible = new Destructible(1000, 't/middleware')

    var server

    async([function () {
        destructible.completed.wait(async())
        async(function () {
            var delta = require('delta')

            async([function () {
                destructible.destroy()
            }], function () {
                destructible.monitor('client', Client, async())
                destructible.monitor('middleware', Middleware, function (request, response) {
                    response.writeHead(200, { 'content-type': 'text/plain', connection: 'close' })
                    response.end('hello, world')
                }, async())
            }, function (client, middleware) {
                async(function () {
                    destructible.monitor('server', Server, middleware, 'socket', async())
                }, function (server) {
                    client.read.shifter().pumpify(server.write)
                    server.read.shifter().pumpify(client.write)
                    destructible.destruct.wait(function () { client.write.push(null) })
                    destructible.destruct.wait(function () { server.write.push(null) })
                }, function () {
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
                        timeout: 4000
                    }, async())
                }, function (body, response) {
                    okay(body, 'hello, world', 'index')
                })
            })
        })
    }, function (error) {
        throw error
    }])
}
