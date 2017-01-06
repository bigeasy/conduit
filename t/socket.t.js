require('proof')(1, prove)

function prove (assert) {
    var Socket = require('../socket')
    assert(Socket, 'require')
}
