const assert = require('assert')

// An `async`/`await` message queue. **TODO** Rename `Avenue`.
const Queue = require('avenue')

// Detailed exceptions that can be caught by type.
const Interrupt = require('interrupt')

// A tree of cancellable strands.
const Destructible = require('destructible')

// The proper way, the only way, to end a `Conduit` is to terminate its input
// stream, so although `Conduit` is a `Destructible`-based class we do not pass
// in its `Destructible`. We do not want the `Conduit` to destroy itself because
// the parent `Destructible` is destroyed. We want the user destroy the
// `Conduit` by ending the input stream, so it's the user's responsibility to
// decide if the `Conduit` should run until the stream drains, or if the
// `Conduit` should shutdown immediately by destroying the given shifter.

// Destruction should mean sending a final message to the other side, so that
// we're shutting down in an orderly fashion, terminating all the end points
// correctly, or maybe timing out and hanging up prior to scram.

// Recall that this is something you've considered and reconsisdered. It keeps
// coming up. We don't want shutdown to be so brutal all the time.

class Conduit {
    static Error = Interrupt.create('Conduit.Error')

    constructor (...vargs) {
        this._destructible = vargs.shift()
        this._shifter = vargs.shift()
        this._queue = vargs.shift()
        this._responder = vargs.shift()

        this.pumping = false
        this.destroyed = false

        this._instance = 0
        this._identifier = 0n
        this._written = 0n
        this._read = 0n
        this._queues = {}

        this._sendable = this._destructible.durable('outboxes')
        const respondable = this._destructible.durable('responder')
        const receivable = this._destructible.durable('inboxes')

        this.eos = new Promise(resolve => this._eos = resolve)

        const shutdown = async () => {
            await this.eos
            this._sendable.destructed
            await respondable.destructed
            for (const key in this._queues) {
                this._queues[key].push(null)
            }
            await receivable.destructed
            this.destroyed = true
            this._queue.push(null)
        }

        this._destructible.durable('shutdown', shutdown())

        // **TODO** Document the use of the responder function as a
        // `Destructible` monitored shifter function. It might reduce the number
        // of sub-destructibles in an application.
        // **TODO** Just use request.

        const respond = async (body, request) => {
            const response = await this._responder.call(null, body.header, request.queue, request.shifter)
            if (!body.shifter) {
                request.queue.enqueue([ response, null ])
            }
        }

        const receive = (entry) => {
            if (entry == null) {
                for (const key in this._queues) {
                    const split = key.split(':')
                    if (split[1] ==  'inbox') {
                        receive({
                            module: 'conduit',
                            to: split[0],
                            method: 'envelope',
                            series: this._read.toString(16),
                            identifier: split[2],
                            forced: true,
                            body: null
                        })
                    }
                }
                this._eos.call()
            } else {
                Conduit.Error.assert(this._read.toString(16) == entry.series, 'series.mismatch', {
                    read: this._read.toString(16),
                    written: this._written.toString(16),
                    entry: entry
                })
                this._read++
                const { identifier } = entry
                switch (entry.to) {
                case 'server':
                    switch (entry.method) {
                    case 'connect':
                        const down = this._queues['server:outbox:' + identifier] = new Queue
                        const request = { entry: entry, queue: down, shifter: null }
                        if (entry.body.queue) {
                            const up = new Queue
                            this._queues[`server:inbox:${identifier}`] = up
                            request.shifter = up.shifter()
                        }
                        receivable.ephemeral([
                            'server', 'outbox', identifier
                        ], request.queue.shifter().pump(async entry => {
                            if (entry == null) {
                                delete this._queues[`server:outbox:${identifier}`]
                            }
                            this._queue.push({
                                module: 'conduit',
                                to: 'client',
                                method: 'envelope',
                                series: (this._written++).toString(16),
                                identifier: identifier,
                                body: entry
                            })
                        }))
                        const instance = this._instance = (this._instance + 1) & 0xfffffff
                        respondable.ephemeral([
                            'request', identifier
                        ], respond(entry.body, request))
                        break
                    case 'envelope':
                        this._queues[`server:inbox:${identifier}`].push(entry.body)
                        if (entry.body == null) {
                            delete this._queues[`server:inbox:${identifier}`]
                        }
                        break
                    }
                    break
                case 'client':
                    switch (entry.method) {
                    case 'envelope':
                        this._queues[`client:inbox:${identifier}`].push(entry.body)
                        if (entry.body == null) {
                            delete this._queues[`client:inbox:${identifier}`]
                        }
                    }
                    break
                }
            }
        }

        this._destructible.durable('queue', this._shifter.pump(receive))
    }

    queue (header) {
        // would return shifter and queue
        return this._request(header, true, true)
    }

    shifter (header) {
        // would return shifter and no queue
        return this._request(header, true, false)
    }

    // **TODO** I like `invoke` better.
    invoke (header) {
        // would return the first entry as a promise
        return this._request(header, false, false)
    }

    _request (header, shifter, queue) {
        const identifier = (this._identifier++).toString(16)
        const inbox = this._queues[`client:inbox:${identifier}`] = new Queue
        const response = { queue: null, shifter: inbox.shifter() }
        const request = { header, shifter, queue }
        if (queue) {
            const outbox = this._queues[`client:outbox:${identifier}`] = response.queue = new Queue
            this._sendable.ephemeral([
                'queue', identifier
            ], response.queue.shifter().pump(entry => {
                if (entry == null) {
                    delete this._queues[`client:outbox:${identifier}`]
                } else {
                    Conduit.Error.assert(this._queues[`client:outbox:${identifier}`], 'missing.outbox')
                }
                this._queue.push({
                    module: 'conduit',
                    to: 'server',
                    method: 'envelope',
                    series: (this._written++).toString(16),
                    identifier: identifier,
                    body: entry
                })
            }))
        }
        this._queue.push({
            module: 'conduit',
            to: 'server',
            method: 'connect',
            series: (this._written++).toString(16),
            identifier: identifier,
            body: request
        })
        // If they want a shifter, give them one. If they want a queue then they
        // are going to have to shift the response themselves.
        if (shifter || queue) {
            return response
        }
        const result = response.shifter.shift()
        result.then(() => response.shifter.destroy())
        return result
    }
}

module.exports = Conduit
