var WebSocket = require('faye-websocket'),
    ws        = new WebSocket.Client('ws://127.0.0.1:8000/')

ws.on('open', function(event) {
  console.log('open')
  ws.send('Hello, world!')
})

ws.on('message', function(event) {
  console.log('message', event.data)
})

ws.on('close', function(event) {
  console.log('close', event.code, event.reason)
  ws = null
})
