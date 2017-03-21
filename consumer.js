var cadence = require('cadence')
var Signal = require('signal')
var Scheduler = require('happenstance').Scheduler
var Procession = require('procession')
var coalesce = require('extant')
var Monotonic = require('monotonic').asString
var abend = require('abend')

function Consumer (turnstile, qualifier, read, write, options) {
    options = coalesce(options, {})
    this.turnstile = turnstile
    this.scheduler = new Scheduler
    this.scheduler.events.pump(this, '_timedout')
    this._timeout = coalesce(options.timeout, 5000)
    this._window = coalesce(options.window, 64)
    this._qualifier = qualifier
    this.read = new Procession
    this.write = new Procession
    this.write.pump(write)
    this._windows = [{ end: '1', count: this._window }]
    read.pump(this, '_produced')
}

// Curious thought. Going to put back-pressure and I know I've imagined chaining
// a requester and responder in order to have a control channel, so now I'm
// wanting to multiplex. The only multiplex tool I have is client and server. Is
// that going to be easy enough to get started? I moved away from the
// Multiplexer because it seemed a pain to get started. It would be nice if the
// conduit multiplexed, or if you could say, please devide this stream up into
// three streams, say, with certain names. And then we're back to multiplexing.

// Hmm… So it does seem like a Multiplexer as you just described would be nice
// to have.

Consumer.prototype._produced = cadence(function (async, envelope) {
    if (envelope == null) {
        this.read.enqueue(null, async())
    } else if (
        envelope.module == 'conduit/producer' &&
        envelope.method == 'produced' &&
        envelope.qualifier == this._qualifier
    ) {
        if (Monotonic.compare(envelope.sequence, this._windows[0].end) >= 0) {
            this._windows.unshift({
                start: this._windows[0].end,
                end: Monotonic.add(this._windows[0].end, this._window),
                count: 0,
                greatest: '0'
            })
        }
        this.turnstile.enter({
            started: async(),
            completed: function (error) {
                abend(error)
                this._completed(envelope.sequence)
            }.bind(this),
            body: envelope.body
        })
    } else {
        this.read.enqueue(envelope, async())
    }
})

Consumer.prototype._completed = function (sequence) {
    this.scheduler.schedule(Date.now() + this._timeout, 'timeout', null)
    var window = null
    for (var i = 0, I = this._windows.length; i < I; i++) {
        if (Monotonic.compare(sequence, this._windows[i].start) >= 0) {
            window = this._windows[i]
            break
        }
    }
    window.count++
    if (Monotonic.compare(sequence, window.greatest) > 0) {
        window.greatest = sequence
    }
    if (window.count == this._window) {
        this._flush(abend)
    }
}

Consumer.prototype._timedout = cadence(function (async, envelope) {
    if (envelope.method != 'event') {
        return []
    }
    this._flush(async())
})

Consumer.prototype._flush = cadence(function (async) {
    var sequence = null
    for (;;) {
        var window = this._windows[this._windows.length - 2]
        if (this._window == window.count) {
            sequence = window.end
            this._windows.pop()
            continue
        }
        if (this._windows.length != 2) {
            break
        }
        var difference = Monotonic.difference(window.greatest, window.start, 0) + 1
        if (window.count == difference) {
            sequence = window.greatest
            break
        }
        break
    }
    if (sequence != null) {
        this.write.enqueue({
            module: 'conduit/consumer',
            method: 'consumed',
            qualifier: this._qualifier,
            sequence: sequence
        }, async())
    }
})

module.exports = Consumer
