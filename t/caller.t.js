require('proof')(5, prove)

function prove (assert) {
    var Caller = require('../caller')
    var Procession = require('procession')
    var abend = require('abend')

    var caller = new Caller
    caller.listen(function (error) {
        assert(error == null, 'done')
    })

    var shifter = caller.read.shifter()

    caller.invoke(1, function (error, result) {
        assert(result, 2, 'invoke')
    })

    assert(shifter.shift(), {
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
        assert(/^conduit#endOfStream$/m.test(error.message), 'response eos')
    })

    caller.write.push(null)

    caller.invoke(1, function (error) {
        assert(/^conduit#endOfStream$/m.test(error.message), 'invoke eos')
    })

    caller.destroy()
}
