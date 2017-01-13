var cadence = require('cadence')
var Interlocutor = require('interlocutor')
var protocols = { http: require('http'), https: require('https') }
var Conduit = require('./socket')
var Header = require('./header')
var url = require('url')
var Cache = require('magazine')

function Client (middleware, request, socket, head) {
    this._interlocutor = new Interlocutor(middleware)
    this._socket = socket
    this._magazine = new Cache().createMagazine()
    this._header = new Header
    this._consume(head, 0, head.length)
    this._socket.on('data', this._data.bind(this))
}

Client.prototype._data = function (buffer) {
    var count = 0
    for (var start = 0;  start != buffer.length;) {
        if (++count == 5) throw new Error
        start = this._consume(buffer, start, buffer.length)
    }
}

Client.prototype._consume = function (buffer, start, end) {
    if (this._header.object != null) {
        var length = Math.min(buffer.length, this._header.object.length)
        var cartridge = this._magazine.hold(cookie, null)
        cartridge.value.response.write(buffer.slice(start, start + length))
        start += length
        cartridge.release()
        this._header = new Header
    }
    start = this._header.parse(buffer, start, end)
    if (this._header.object != null) {
        switch (this._header.object.type) {
        case 'header':
            var headers = this._header.object.headers
            headers['sec-conduit-rendezvous-actual-path'] = this._header.object.actualPath
            this._header.object.rawHeaders.push('sec-conduit-rendezvous-actual-path', this._header.object.actualPath)
            var request = this._interlocutor.request({
                httpVersion: this._header.object.httpVersion,
                method: this._header.object.method,
                url: this._header.object.url,
                headers: headers,
                rawHeaders: this._header.object.rawHeaders
            })
            var socket = this._socket, cookie = this._header.object.cookie
            request.on('response', function (response) {
                socket.write(new Buffer(JSON.stringify({
                    type: 'header',
                    cookie: cookie,
                    statusCode: response.statusCode,
                    statusMessage: response.statusMessage,
                    headers: response.headers
                }) + '\n'))
                response.on('data', function (buffer) {
                    socket.write(new Buffer(JSON.stringify({
                        type: 'chunk',
                        cookie: cookie,
                        length: buffer.length
                    }) + '\n'))
                    socket.write(buffer)
                })
                response.on('end', function () {
                    socket.write(new Buffer(JSON.stringify({ type: 'trailer', cookie: cookie }) + '\n'))
                })
                // response.on('error', function (error) {})
            })
            this._magazine.hold(this._header.object.cookie, request).release()
            this._header = new Header
            break
        case 'chunk':
            break
        case 'trailer':
            var cartridge = this._magazine.hold(this._header.object.cookie, null)
            cartridge.value.end()
            cartridge.remove()
            this._header = new Header
            break
        }
    }
    return start
}

Client.prototype.close = cadence(function (async) {
    this._socket.end(async())
    this._socket.destroy()
})

exports.connect = cadence(function (async, location, middleware) {
    var parsed = url.parse(location)
    async(function () {
        Conduit.connect({
            secure: parsed.protocol == 'https:',
            host: parsed.hostname,
            port: parsed.port,
            auth: parsed.auth,
            headers: {
                'sec-conduit-rendezvous-path': parsed.path
            }
        }, async())
    }, function (request, socket, head) {
        return new Client(middleware, request, socket, head)
    })
})
