require('proof/redux')(1, prove)

function prove (assert) {
    var Prefixer = require('../prefixer')
    var prefixer = new Prefixer('$')
    assert(prefixer.map({ cookie: 'submit' }), '$submit', 'map')
}
