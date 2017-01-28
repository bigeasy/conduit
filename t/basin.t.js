require('proof/redux')(2, prove)

function prove (assert) {
    var Basin = require('../basin')
    assert(Basin.Responder, 'responder required')
    assert(Basin.Transformer, 'transformer required')
}
