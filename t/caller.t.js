require('proof')(4, require('cadence')(prove))

function prove (async, okay) {
    var Caller = require('../caller')
    var Procession = require('procession')
    var Destructible = require('destructible')
    var abend = require('abend')

    var destructible = new Destructible('t/caller.t.js')

    async(function () {
        destructible.monitor('caller', Caller, async())
    }, function (caller) {
        destructible.destruct.wait(async())

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

        destructible.destroy()
    })
}
