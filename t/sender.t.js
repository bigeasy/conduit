require('proof')(3, require('cadence')(prove))

function prove (async, okay) {
    var Sender = require('../sender')
    var Procession = require('procession')

    var read = new Procession
    var shifter = read.shifter()

    var stream = require('stream')
    var through = new stream.PassThrough
    through.trailers = { key: 'value' }

    async(function () {
        Sender(through, read, 'conduit/sender', async())
        through.write('hello, world')
        through.end()
    }, function () {
        okay(shifter.shift().body.toString(), 'hello, world', 'chunk')
        okay(shifter.shift(), {
            module: 'conduit/sender',
            method: 'trailer',
            body: { key: 'value' }
        }, 'trailer')
        okay(shifter.shift(), null, 'eos')
    })
}
