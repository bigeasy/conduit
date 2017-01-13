var delta = require('delta')
var cadence = require('cadence')

var PROTOCOL = {
    http: require('http'),
    https: require('https')
}

exports.connect = cadence(function (async, options) {
    options = {
        port: options.port,
        host: options.host || 'localhost',
        secure: options.secure == null ? false : options.secure,
        hashKey: options.hashKey == null ? '' : options.hashKey,
        headers: options.headers || {}
    }
    var protocol = options.secure ? PROTOCOL.https : PROTOCOL.http
    var headers = {
        connection: 'Upgrade',
        upgrade: 'Conduit',
        host: options.host + ':' + options.port,
        'sec-conduit-protocol-id': 'c2845f0d55220303d62fc68e4c145877',
        'sec-conduit-version': 1,
        'sec-conduit-hash-key': options.hashKey == null ? '' : options.hashKey
    }
    for (var name in options.headers) {
        headers[name] = options.headers[name]
    }
    var request = protocol.request({
        port: options.port,
        host: options.host,
        headers: headers
    })
    request.on('response', function () {
        console.log('called')
    })
    async(function () {
        delta(async()).ee(request).on('upgrade')
        request.end()
    }, function (request, socket, head) {
        return [ request, socket, head ]
    })
})
