var WebSocket = require('ws')
var ws = new WebSocket('ws://127.0.0.1:8088/path')

ws.on('open', function open() {
    ws.send('something')
})

ws.on('message', function(data, flags) {
    console.log(data)
    console.log(flags)
    // flags.binary will be set if a binary data is received.
    // flags.masked will be set if the data was masked.
})
