require('proof')(9, require('cadence')(prove))

function prove (async, assert) {
    var Conduit = require('..')
    var Producer = require('../producer')
    var Consumer = require('../consumer')
    var Timer = require('happenstance').Timer

    var abend = require('abend')

    var stream = require('stream')
    var delta = require('delta')

    var abend = require('abend')

    var cadence = require('cadence')
    var input = new stream.PassThrough
    var output = new stream.PassThrough
    var conduit = {
        client: new Conduit(input, output),
        server: new Conduit(output, input)
    }
    var count = 0
    var object = {
        consume: cadence(function (async, envelope) {
            console.log('called')
        })
    }
    var count = 1
    var turnstile = {
        enter: function (envelope) {
            assert(envelope.body, count, 'work ' + count)
            count++
            envelope.started.call(null)
            if (count == 2 || count == 5) {
                setTimeout(function () {
                    envelope.completed.call(null)
                }, 200)
            } else {
                envelope.completed.call(null)
            }
        }
    }
    var producer = new Producer('messages')
    var pump = producer.pump(conduit.client.read, conduit.client.write)
    var consumer = new Consumer(turnstile, 'messages', conduit.server.read, conduit.server.write, {
        window: 5,
        timeout: 100
    })
    consumer.scheduler.events.pump(new Timer(consumer.scheduler), 'enqueue')

    conduit.server.listen(async())
    conduit.client.listen(async())

    async(function () {
        producer.queue.push(1)
        producer.queue.push(2)
        setTimeout(async(), 500)
    }, function () {
        producer.queue.push(3)
        producer.queue.push(4)
        producer.queue.push(5)
        producer.queue.push(6)
    }, function () {
        pump.read.shifter().dequeue(async())
        consumer.write.enqueue({ module: 'ignore' }, async())
    }, function (envelope) {
        assert(envelope, { module: 'ignore' }, 'consumer pass through')
        setTimeout(async(), 300)
    }, function () {
        consumer.read.shifter().dequeue(async())
        pump.write.enqueue({ module: 'ignore' }, async())
    }, function (envelope) {
        assert(envelope, { module: 'ignore' }, 'producer pass through')
        pump.read.shifter().dequeue(async())
        consumer.write.enqueue(null, async())
    }, function (envelope) {
        assert(envelope, null, 'end producer stream')
        pump.write.enqueue(null, async())
    }, function () {
        conduit.client.destroy()
        conduit.server.destroy()
    })
}
