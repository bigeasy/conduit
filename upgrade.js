var assert = require('assert')
var events = require('events')
var util = require('util')

function Upgrade () {
}
util.inherits(Upgrade, events.EventEmitter)

Upgrade.prototype.upgrade = function (request, socket, head) {
    if (request.headers['sec-conduit-protocol-id'] != 'c2845f0d55220303d62fc68e4c145877') {
        return false
    }
    assert(head.length == 0, 'head buffer must be zero length')
    socket.write(
        'HTTP/1.1 101 Conduit Protocol Handshake\r\n' +
        'Connection: Upgrade\r\n' +
        'Upgrade: Conduit\r\n' +
        '\r\n'
    )
    this.emit('socket', request, socket)
    return true
}

module.exports = Upgrade
