require('proof')(1, require('cadence')(prove))

function prove (async, assert) {
    var Conduit = require('..')
    var stream = require('stream')
    var abend = require('abend')

    function createConduit () {
        var input = new stream.PassThrough
        var output = new stream.PassThrough
        var conduit = new Conduit(input, output)
        return {
            input: input,
            output: output,
            conduit: conduit
        }
    }

    var first = createConduit()
    var second = createConduit()

    first.conduit.listen(abend)
    second.conduit.listen(abend)

    var buffer = new Buffer('qwertyuiop')

    first.conduit.write.push({
        module: 'conduit', method: 'example',
        body: { body: buffer }
    })
    var buffer = first.output.read()

    var shifter = second.conduit.read.shifter()

    second.input.write(buffer.slice(0, 10))
    second.input.write(buffer.slice(10, 120))
    second.input.write(buffer.slice(120))

    var shifted = shifter.shift()
    shifted.body.body = shifted.body.body.toString()
    assert(shifted, {
        module: 'conduit', method: 'example',
        body: { body: 'qwertyuiop' }
    }, 'piecemeal')

    first.conduit.destroy()

    first.conduit.write.push({})
}
