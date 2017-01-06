var http = require('http')

var server = http.createServer()

server.on('upgrade', function (request, socket, header) {
    console.log(request.headers, header)
    socker.destroy()
})

server.listen(8088)
