var assert = require('assert')
var cadence = require('cadence')
var Cache = require('magazine')
var Monotonic = require('monotonic').asString
var WildMap = require('wildmap')
var url = require('url')
var Header = require('./header')

function Rendezvous () {
    this._magazine = new Cache().createMagazine()
    this._cookie = '0'
    this._requestNumber = 0xffffffff
    this._connections = new WildMap
    this._paths = []
    this._header = new Header
}

Rendezvous.prototype.listener = function (callback, request, response) {
    this.middleware(request, response, callback)
}

Rendezvous.prototype.middleware = function (request, response, next) {
    var parsed = url.parse(request.url)
    var path = parsed.path.split('/')
    var connection = this._connections.match(path).pop()
    if (connection) {
        var cookie = this._nextCookie()
        var request = new Request(connection, request, response, cookie)
        // Note somewhere that this doesn't race because we only have one thread, we
        // don't have to let go at the end of the function or anything.
        this._magazine.hold(cookie, request).release()
        request.consume(function (error) { if (error) next(error) })
    } else {
        next()
    }
}

Rendezvous.prototype.upgrade = function (request, socket) {
    var path = request.headers['sec-conduit-rendezvous-path']
    if (path == null) {
        return false
    }
    var paths = this._paths, connections = this._connections, magazine = this._magazine

    path = path.split('/')

    var connection = connections.get(path)[0]
    if (connection != null) {
        connection.close.call(null)
    }
    connection = {
        path: path.join('/'),
        close: close,
        socket: socket
    }
    connections.add(path, connection)
    this._paths.push(path.join('/'))

    socket.on('data', this._data.bind(this))
    socket.once('close', close)

    //socket.once('error', function () { })

    function close () {
        connections.remove(path, connections.get(path)[0])
        paths.splice(paths.indexOf(path.join('/')), 1)
        socket.destroy()
    }
    return true
}

Rendezvous.prototype._nextCookie = function () {
    return this._cookie = Monotonic.increment(this._cookie, 0)
}

Rendezvous.prototype._data = function (buffer) {
    for (var start = 0;  start != buffer.length;) {
        start = this._consume(buffer, start, buffer.length)
    }
}

function Request (connection, request, response, cookie) {
    this._socket = connection.socket
    this._path = connection.path
    this._request = request
    this.response = response
    this._cookie = cookie
}

// http://stackoverflow.com/a/5426648
Request.prototype.consume = cadence(function (async) {
    var location = url.parse(this._request.url)
    var path = location.pathname
    location.pathname = location.pathname.substring(this._path.length)
    location = url.format(location)
    this._socket.write(new Buffer(JSON.stringify({
        type: 'header',
        cookie: this._cookie,
        httpVersion: this._request.httpVersion,
        method: this._request.method,
        url: location,
        headers: this._request.headers,
        actualPath: path,
        rawHeaders: this._request.rawHeaders
    }) + '\n'))
    async([function () {
        delta(async()).ee(this._request).on('end').on('data', this._consume.bind(this))
    }, function (error) {
    }], function () {
        this._socket.write(new Buffer(JSON.stringify({
            type: 'trailer',
            cookie: this._cookie
        }) + '\n'))
    })
})

Request.prototype._consume = function (buffer) {
    this._socket.write(new Buffer(JSON.stringify({
        type: 'chunk',
        cookie: this._cookie,
        length: buffer.length
    }) + '\n'))
    this._socket.write(buffer)
}

Rendezvous.prototype._consume = function (buffer, start, end) {
    if (this._header.object != null) {
        var length = Math.min(buffer.length, this._header.object.length)
        var cartridge = this._magazine.hold(this._header.object.cookie, null)
        cartridge.value.response.write(buffer.slice(start, start + length))
        start += length
        cartridge.release()
        this._header = new Header
    }
    start = this._header.parse(buffer, start, end)
    if (this._header.object != null) {
        switch (this._header.object.type) {
        case 'header':
            var cartridge = this._magazine.hold(this._header.object.cookie, null)
            cartridge.value.response.writeHead(
                this._header.object.statusCode, this._header.object.statusMessage, this._header.object.headers)
            cartridge.release()
            this._header = new Header
            break
        case 'chunk':
            break
        case 'trailer':
            var cartridge = this._magazine.hold(this._header.object.cookie, null)
            cartridge.value.response.end()
            cartridge.remove()
            this._header = new Header
            break
        }
    }
    return start
}

Request.prototype._respond = function (buffer) {
    var start = 0
    while (start < buffer.length) {
        start = this._consume(buffer, start, buffer.length)
    }
}

Request.prototype.request = function (request, response) {
}

Rendezvous.prototype.close = cadence(function (async) {
        async.forEach(function (path) {
            this._connections.get(path.split('/'))[0].socket.end(async())
        })(this._paths)
})

module.exports = Rendezvous
