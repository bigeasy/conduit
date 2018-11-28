require('proof')(1, require('cadence')(prove))

function prove (async, okay) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var destructible = new Destructible('t/procedure.t.js')

    destructible.destruct.wait(async())

    var Procedure = require('../procedure')

    var abend = require('abend')

    async(function () {
        destructible.durable('procedure', Procedure, function (value, callback) {
            callback(null, value + 1)
        }, async())
    }, function (procedure) {
        destructible.completed.wait(async())

        var shifter = procedure.outbox.shifter()

        procedure.inbox.push({})
        procedure.inbox.push({
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

        procedure.inbox.push(null)
    })
}
