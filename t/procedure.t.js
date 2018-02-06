require('proof')(1, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')

    var Procedure = require('../procedure')

    var abend = require('abend')

    var procedure = new Procedure(function (value, callback) {
        callback(null, value + 1)
    })
    procedure.listen(abend)

    var shifter = procedure.read.shifter()

    procedure.write.push({})
    procedure.write.push({
        module: 'conduit/caller',
        method: 'invoke',
        cookie: '1',
        body: 1
    })

    okay(shifter.shift(), {
        module: 'conduit/procedure',
        method: 'invocation',
        cookie: '1',
        body: 2
    }, 'response')
}
