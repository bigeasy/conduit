require('proof')(5, prove)

function prove (okay) {
    var Procession = require('procession')

    var Multiplexer = require('../multiplexer')

    okay(Multiplexer, 'require')

    var receiver = { read: new Procession, write: new Procession }
    var multiplexer = new Multiplexer({ x: receiver })
    multiplexer.listen(function (error) {
        okay(error == null, 'done')
    })

    var read = receiver.write.shifter()
    multiplexer.write.push({
        module: 'conduit/multiplexer',
        method: 'envelope',
        qualifier: 'x',
        body: 2
    })
    okay(read.shift(), 2, 'receive')
    var write = multiplexer.read.shifter()
    receiver.read.push(1)
    okay(write.shift(), {
        module: 'conduit/multiplexer',
        method: 'envelope',
        qualifier: 'x',
        body: 1
    }, 'send')
    multiplexer.write.push({})
    multiplexer.write.push(null)
    read.shift()
    okay(read.endOfStream, 'eos')
}
