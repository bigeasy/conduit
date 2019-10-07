require('proof')(1, prove)

async function prove (okay) {
    var Queue = require('avenue')

    var Conduit = require('../conduit')

    var Middleware = require('../middleware')
    var Requester = require('../requester')

    var destroyer = require('server-destroy')

    const once = require('prospective/once')

    var http = require('http')
    var Destructible = require('destructible')
    const axios = require('axios')

    const destructible = new Destructible(1000, 't/middleware.t')

    const middleware  = new Middleware(destructible.durable('middleware'), function (request, response) {
        response.writeHead(200, { 'content-type': 'text/plain', connection: 'close' })
        response.end('hello, world')
    })

    const inbox = new Queue, outbox = new Queue

    const client = new Conduit(destructible.durable('client'), inbox.shifter(), outbox)
    new Conduit(destructible.durable('client'), outbox.shifter(), inbox, function (header, queue, shifter) {
        middleware.request(header.body, shifter, queue)
    })

    const requester = new Requester(destructible.durable('requester'), client)

    const server = http.createServer(function (request, response) {
        requester.request(request, response)
    })

    destroyer(server)
    server.listen(8888, '127.0.0.1')
    destructible.destruct(() => server.destroy())
    await once(server, 'listening').promise

    const got = await axios.get('http://127.0.0.1:8888')
    okay(got.data, 'hello, world', 'got')

    inbox.push(null)
    outbox.push(null)
    destructible.destroy()
    await destructible.destructed
}
