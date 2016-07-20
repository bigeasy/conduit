require('proof')(1, prove)

function prove (assert) {
    var Conduit = require('..')
    assert(Conduit, 'require')
}
