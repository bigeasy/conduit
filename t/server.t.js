require('proof/redux')(11, require('cadence')(prove))

function prove (async, assert) {
    var Conduit = require('../conduit')
    var Client = require('../client')
    var Server = require('../server')

    var abend = require('abend')

    var stream = require('stream')
    var delta = require('delta')

    var abend = require('abend')

    var cadence = require('cadence')
    var input = new stream.PassThrough
    var output = new stream.PassThrough
    var conduit = {
        client: new Conduit(input, output),
        server: new Conduit(output, input)
    }
    var count = 0
    var object = {
        enqueue: cadence(function (async, envelope) {
            switch (count++) {
            case 0:
                assert(Buffer.isBuffer(envelope), 'is buffer')
                assert(envelope.toString(), 'y', 'buffer')
                break
            case 1:
                assert(envelope, 'z', 'json')
                socket.server.write.push('a')
                server.write.push('z')
                break
            case 2:
                assert(envelope, null, 'end of server socket')
                socket.server.write.push(null)
                socket.server.write.push(null)
                break
            case 3:
                assert(envelope, 'b', 'reopen')
                break
            }
        })
    }
    var client = new Client('service', conduit.client.read, conduit.client.write)
    var server = new Server(function (_socket, header) {
        assert(header, 'x', 'header')
        socket.server = _socket
        socket.server.read.pump(object)
    }, 'service', conduit.server.read, conduit.server.write)

    async(function () {
        conduit.client.listen(async())
        conduit.server.listen(async())
    })

    var socket = {
        client: client.connect('x'),
        server: null
    }
    var read = {
        socket: socket.client.read.shifter(),
        client: client.read.shifter()
    }
    socket.client.write.push(new Buffer('y'))
    socket.client.write.push('z')

    async(function () {
        read.socket.dequeue(async())
        read.client.dequeue(async())
    }, [], function (envelopes) {
        assert(envelopes[0], 'a', 'socket response')
        assert(envelopes[1], 'z', 'client pass-through response')
        socket.client.write.push(null)
        socket.client.write.push(null)
        read.socket.dequeue(async())
    }, function (envelope) {
        assert(envelope, null, 'end of client socket')
        client.connect('x', async())
    }, function (socket) {
        socket.client = socket
        socket.client.write.push('b')
        socket.client.destroy()
        socket.client.write.push('c')
        conduit.client.read.push(null)
        read.client.dequeue(async())
    }, function (envelope) {
        assert(envelope, null, 'client end of stream')
        conduit.server.destroy()
        conduit.client.destroy()
    })
}
