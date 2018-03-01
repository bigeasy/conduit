require('proof')(5, require('cadence')(prove))

function prove (async, okay) {
    var Caller = require('../caller')
    var Procession = require('procession')
    var abend = require('abend')

    var Destructible = require('destructible')
    var destructible = new Destructible('t/destructible')

    var caller = new Caller
    async(function () {
        destructible.monitor('destructible', caller, 'monitor', async())
    }, function (cookie) {
        var shifter = caller.read.shifter()

        caller.invoke(1, function (error, result) {
            okay(result, 2, 'invoke')
        })

        okay(shifter.shift(), {
            module: 'conduit/caller',
            method: 'invoke',
            cookie: '1',
            body: 1
        }, 'invoke envelope')

        caller.write.push({})
        caller.write.push({
            module: 'conduit/procedure',
            method: 'invocation',
            cookie: '1',
            body: 2
        })

        caller.invoke(1, function (error) {
            okay(/^conduit#endOfStream$/m.test(error.message), 'response eos')
        })

        caller.write.push(null)

        caller.invoke(1, function (error) {
            okay(/^conduit#endOfStream$/m.test(error.message), 'invoke eos')
        })

        destructible.completed.wait(async())
    }, function () {
        okay(true, 'finished')
    })
}
