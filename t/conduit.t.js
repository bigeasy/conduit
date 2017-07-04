require('proof')(5, require('cadence')(prove))

function prove (async, okay) {
    var Conduit = require('..')
    var stream = require('stream')
    var abend = require('abend')
    var Procession = require('procession')

    function createConduit () {
        var receiver = { read: new Procession, write: new Procession }
        var input = new stream.PassThrough
        var output = new stream.PassThrough
        var conduit = new Conduit(input, output, receiver)
        return {
            input: input,
            output: output,
            conduit: conduit,
            receiver: receiver
        }
    }

    var first = createConduit()
    var second = createConduit()

    first.conduit.listen(abend)
    second.conduit.listen(abend)

    var buffer = new Buffer('qwertyuiop')

    first.conduit.receiver.read.push({
        module: 'conduit', method: 'example',
        body: { body: buffer }
    })
    var buffer = first.output.read()

    var shifter = second.conduit.receiver.write.shifter()

    second.input.write(buffer.slice(0, 10))
    second.input.write(buffer.slice(10, 120))
    second.input.write(buffer.slice(120))

    var shifted = shifter.shift()
    shifted.body.body = shifted.body.body.toString()
    okay(shifted, {
        module: 'conduit', method: 'example',
        body: { body: 'qwertyuiop' }
    }, 'piecemeal')

    okay(shifter.shift(), null, 'empty')
    second.input.write(buffer)

    var shifted = shifter.shift()
    shifted.body.body = shifted.body.body.toString()
    okay(shifted, {
        module: 'conduit', method: 'example',
        body: { body: 'qwertyuiop' }
    }, 'full buffer')

    first.conduit.receiver.read.push(1)
    second.input.write(first.output.read())
    okay(shifter.shift(), 1, 'envelope')

    first.conduit.receiver.read.push(null)
    second.input.write(first.output.read())
    okay(second.conduit.receiver.write.endOfStream, 'eos')

    first.conduit.destroy()

    first.conduit.receiver.read.push({})
}
