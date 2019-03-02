require('proof')(1, prove)

function prove (okay, callback) {
    var Procession = require('procession')
    var Destructible = require('destructible')

    var destructible = new Destructible('t/procedure.t.js')

    destructible.completed.wait(callback)

    var Procedure = require('../procedure')

    var abend = require('abend')

    var cadence = require('cadence')

    cadence(function (async) {
        async(function () {
            destructible.durable('procedure', Procedure, function (value, callback) {
                callback(null, value + 1)
            }, async())
        }, function (procedure) {
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
    })(destructible.durable('test'))
}
