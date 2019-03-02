require('proof')(2, prove)

function prove (okay) {
    var Timeout = require('../timeout')
    okay(Timeout(1000, [ 'x' ]), 1000, 'default')
    okay(Timeout(1000, [ 2000 ]), 2000, 'specified')
}
