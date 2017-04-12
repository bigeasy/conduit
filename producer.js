var cadence = require('cadence')
var Procession = require('procession')
var Monotonic = require('monotonic').asString

function Pump (producer, read, write) {
    this._producer = producer
    this.read = new Procession
    this.write = new Procession
    read.pump(this, '_consumed')
    this.write.pump(write, 'enqueue')
    this._shifter = producer._follower.shifter()
    this._shifter.pump(this, '_enqueue')
}

function Producer (qualifier) {
    this._qualifier = qualifier
    this._sequence = '0'
    this.queue = new Procession
    this.queue.pump(this, '_enqueue')
    this._queue = new Procession
    this._follower = this._queue.shifter()
}

Producer.prototype.pump = function (read, write) {
    return new Pump(this, read, write)
}

Pump.prototype._consumed = cadence(function (async, envelope) {
    if (envelope == null) {
        this.read.push(null)
    } else if (
        envelope.module == 'conduit/consumer' &&
        envelope.method == 'consumed' &&
        envelope.qualifier == this._producer._qualifier
    ) {
        for (;;) {
            var peek = this._producer._follower.peek()
            console.log(peek, envelope)
            if (peek == null || Monotonic.compare(envelope.sequence, peek.sequence) < 0) {
                break
            }
            this._producer._follower.shift()
        }
    } else {
        this.read.push(envelope)
    }
})

// TODO Slighlty unintuitive; the `null` that terminates the queue does get sent
// through the stream but without terminating the conduit stream.

//
Producer.prototype._enqueue = cadence(function (async, envelope) {
    this._queue.enqueue({
        module: 'conduit/producer',
        method: 'produced',
        qualifier: this._qualifier,
        sequence: this._sequence = Monotonic.increment(this._sequence, 0),
        body: envelope
    }, async())
})

Pump.prototype._enqueue = cadence(function (async, envelope) {
    this.write.enqueue(envelope, async())
})

module.exports = Producer
