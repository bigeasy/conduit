// Generate server key, connect and expect upgrade.

var http = require('http')
var crypto = require('crypto')

var key = new Date().toISOString()
var shasum = crypto.createHash('sha1')
shasum.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
var accept = shasum.digest('base64')

var request = http.request({
    port: 8088,
    host: '127.0.0.1',
    headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Host': '127.0.0.1:8088',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key
    }
})

request.on('error', function (error) {
    console.log(error.stack)
})

request.on('response', function (response, socket, upgradeHead) {
    console.log('here')
})

request.on('socket', function (response, socket, upgradeHead) {
    console.log('socket')
})

request.on('upgrade', function (response, socket, upgradeHead) {
    if (!response.headers['sec-websocket-accept'] || response.headers['sec-websocket-accept'] != accept) {
        throw new Error
    }
    console.log(accept)
    console.log(response.headers)
    socket.destroy()
})

request.end()
