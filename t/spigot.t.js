require('proof/redux')(2, prove)

function prove (assert) {
    var Basin = require('../basin')
    assert(Basin.Queue, 'queue required')
    assert(Basin.Responder, 'responder required')
}
