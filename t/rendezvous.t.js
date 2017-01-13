require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var http = require('http')
    var Rendezvous = require('../rendezvous')
    var Envoy = require('../envoy')
    var UserAgent = require('vizsla')
    var ua = new UserAgent
    var Upgrader = require('../upgrade')
    var upgrader = new Upgrader
    var sockets = []
    var rendezvous = new Rendezvous
    upgrader.on('socket', rendezvous.upgrade.bind(rendezvous))
    var server = http.createServer(rendezvous.listener.bind(rendezvous, function (error) {
        if (error) throw error
    }))
    server.on('upgrade', function (request, socket, head) {
        upgrader.upgrade(request, socket, head)
    })
    async(function () {
        server.listen(8088, '127.0.0.1', async())
    }, function () {
        Envoy.connect('http://127.0.0.1:8088/identifier', function (request, response) {
            response.writeHead(200, 'OK', { 'content-type': 'text/plain' })
            response.write('Hello, World!')
            response.end()
        }, async())
    }, function (envoy) {
        async(function () {
            ua.fetch({
                url: 'http://127.0.0.1:8088/identifier/hello'
            }, async())
        }, function (message) {
            assert(message.toString(), 'Hello, World!', 'body')
            envoy.close(async())
            rendezvous.close(async())
            server.close(async())
        })
    }, function () {
        console.log('done')
    })
}
