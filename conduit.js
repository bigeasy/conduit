// Node.js API.
var assert = require('assert')

// Control-flow utilities.
var cadence = require('cadence')

// An evented message queue.
var Procession = require('procession')

// Contextualized callbacks and event handlers.
var Operation = require('operation')

var Turnstile = require('turnstile')
Turnstile.Queue = require('turnstile/queue')

var Signal = require('signal')

var Monotonic = require('monotonic').asString

var instance = 0
function Conduit (destructible, inbox, outbox, vargs) {
    this._connect = vargs[0] != null ? new Operation(vargs) : null

    this._outbox = outbox

    this.instance = 'cnd-' + (instance++)
    destructible.context.push(this.instance)

    this.shifter = inbox.pump(this, '_receive').run(destructible.monitor('receive'))

    this.turnstile = new Turnstile
    this._requests = new Turnstile.Queue(this, '_request', this.turnstile)

    this.turnstile.listen(destructible.monitor('turnstile'))
    destructible.destruct.wait(this.turnstile, 'close')

    this._destructible = destructible
    this._identifier = '0'

    this._streams = {}
}

Conduit.prototype._request = cadence(function (async, envelope) {
    var enqueued = envelope.body
    async(function () {
        this._connect.call(null, enqueued.request, enqueued.inbox, enqueued.outbox, async())
    }, function (response) {
        if (enqueued.response) {
            enqueued.outbox.push(response)
            enqueued.outbox.end()
        }
    })
})

Conduit.prototype._receive = cadence(function (async, envelope) {
    if (envelope == null) {
        async(function () {
            async.forEach([ Object.keys(this._streams) ], function (key) {
                var split = key.split(':')
                switch (split[1]) {
                case 'outbox':
                    this._outbox.shifter().join(function (envelope) {
                        return envelope.module == 'conduit' &&
                               envelope.method == 'envelope' &&
                               envelope.identifier == split[2] &&
                               envelope.body == null
                    }, async())
                    this._streams[key].push(null)
                    break
                case 'inbox':
                    this._receive({
                        module: 'conduit',
                        to: split[0],
                        method: 'envelope',
                        identifier: split[2],
                        body: null
                    }, async())
                    break
                }
            })
        }, function () {
            assert(Object.keys(this._streams).length == 0)
            this._outbox.end()
        })
    } else if (envelope.module == 'conduit') {
        switch (envelope.to) {
        case 'server':
            switch (envelope.method) {
            case 'connect':
                var enqueue = {
                    request: envelope.body,
                    identifier: envelope.identifier,
                    response: false,
                    inbox: null,
                    outbox: new Procession
                }
                this._streams['server:outbox:' + envelope.identifier] = enqueue.outbox
                if (enqueue.request.outbox) {
                    var inbox = this._streams['server:inbox:' + envelope.identifier] = new Procession
                    enqueue.inbox = inbox.shifter()
                }
                if (!enqueue.request.inbox) {
                    enqueue.response = true
                }
                enqueue.outbox.pump(this, function (envelope) {
                    if (envelope == null) {
                        delete this._streams['server:outbox:' + enqueue.identifier]
                    }
                    this._outbox.push({
                        module: 'conduit',
                        to: 'client',
                        method: 'envelope',
                        identifier: enqueue.identifier,
                        body: envelope
                    })
                }).run(this._destructible.monitor([ 'server', 'outbox', enqueue.identifier ], true))
                this._requests.push(enqueue)
                break
            case 'envelope':
                this._streams['server:inbox:' + envelope.identifier].push(envelope.body)
                if (envelope.body == null) {
                    delete this._streams['server:inbox:' + envelope.identifier]
                }
                break
            }
            break
        case 'client':
            switch (envelope.method) {
            case 'envelope':
                this._streams['client:inbox:' + envelope.identifier].push(envelope.body)
                if (envelope.body == null) {
                    delete this._streams['client:inbox:' + envelope.identifier]
                }
            }
            break
        }
    }
})

Conduit.prototype.connect = function (request) {
    var identifier = this._identifier = Monotonic.increment(this._identifier, 0)
    var inbox = new Procession
    var response = { inbox: new Procession, outbox: null }
    if (request.outbox) {
        var outbox =this._streams['client:outbox:' + identifier] =  response.outbox = new Procession
        outbox.pump(this, function (envelope) {
            if (envelope == null) {
                delete this._streams['client:outbox:' + identifier]
            }
            this._outbox.push({
                module: 'conduit',
                to: 'server',
                method: 'envelope',
                identifier: identifier,
                body: envelope
            })
        }).run(this._destructible.monitor([ 'client', 'inbox', identifier ], true))
    }
    response.inbox = inbox.shifter()
    this._streams['client:inbox:' + identifier] = inbox
    this._outbox.push({
        module: 'conduit',
        to: 'server',
        method: 'connect',
        identifier: identifier,
        body: request
    })
    return response
}

module.exports = cadence(function (async, destructible, inbox, outbox) {
    var vargs = []
    vargs.push.apply(vargs, arguments)
    vargs.splice(0, 4)
    return new Conduit(destructible, inbox, outbox, vargs)
})
