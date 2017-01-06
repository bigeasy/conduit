require('proof')(4, require('cadence')(prove))

function prove (async, assert) {
    var http = require('http')
    var delta = require('delta')
    var Upgrader = require('../upgrade')
    var upgrader = new Upgrader
    var sockets = []
    upgrader.on('socket', function (request, socket) {
        sockets.push(socket)
        socket.on('data', function (buffer) {
            socket.write(buffer)
        })
    })
    var server = http.createServer(function (request, response) { throw new Error })
    server.on('upgrade', function (request, socket, head) {
        assert(head.length, 0, 'head is zero')
        assert(request.headers, {
            connection: 'Upgrade',
            upgrade: 'Conduit',
            host: 'localhost:8088',
            'sec-conduit-protocol-id': 'c2845f0d55220303d62fc68e4c145877',
            'sec-conduit-version': '1',
            'sec-conduit-hash-key': ''
        }, 'request')
        upgrader.upgrade(request, socket, head)
    })
    var socket = require('../socket')
    assert(socket, 'require')
    async(function () {
        server.listen(8088, async())
    }, function () {
        socket.connect({ port: 8088 }, async())
    }, function (request, socket, head) {
        socket.write('hello')
        async(function () {
            delta(async()).ee(socket).on('data')
        }, function (data) {
            assert(data.toString(), 'hello', 'echo')
            socket.end(async())
            socket.destroy()
        })
    }, function () {
        sockets.forEach(function (socket) { socket.end(async()) })
        server.close(async())
    })
}
