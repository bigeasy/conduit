var server = require('http').createServer()
var url = require('url')
var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({ server: server })

server.on('request', function (request, response) {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('Hello, World!\n')
})

wss.on('connection', function connection(ws) {
    var location = url.parse(ws.upgradeReq.url, true)
    // you might use location.query.access_token to authenticate or share sessions
    // or ws.upgradeReq.headers.cookie (see
    // http://stackoverflow.com/a/16395220/151312)

    ws.on('message', function incoming(message) {
        console.log('received: %s', message)
    })

    ws.send('something')
})

server.listen(8088)
