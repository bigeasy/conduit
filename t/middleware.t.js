require('proof')(1, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')

    var Client = require('../client')
    var Server = require('../server')

    var Middleware = require('../middleware')
    var Requester = require('../requester')

    var abend = require('abend')

    var client = new Client
    var requester = new Requester(client)
    var middleware = new Middleware(function (request, response) {
        response.writeHead(200, { 'content-type': 'text/plain', connection: 'close' })
        response.end('hello, world')
    })
    var server = new Server(middleware, 'socket')
    server.listen(abend)

    client.read.shifter().pumpify(server.write)
    server.read.shifter().pumpify(client.write)

    var http = require('http')
    var Destructible = require('destructible')
    var UserAgent = require('vizsla')
    var ua = new UserAgent

    var destructible = new Destructible(1000, 't/middleware')

    var server = http.createServer(function (request, response) {
        requester.middleware(request, response, destructible.monitor('request', true))
    })

    destructible.completed.wait(async())

    middleware.listen(destructible.monitor('middleware'))
    destructible.destruct.wait(middleware, 'destroy')

    var delta = require('delta')

    async([function () {
        destructible.destroy()
    }], function () {
        server.listen(8888, '127.0.0.1', async())
    }, function () {
        delta(destructible.monitor('server')).ee(server).on('close')
        destructible.destruct.wait(server, 'close')
        ua.fetch({
            url: 'http://127.0.0.1:8888',
            timeout: 1000
        }, async())
    }, function (body, response) {
        okay(body, 'hello, world', 'index')
    })
}
