// An evented message queue.
const Queue = require('avenue')
const Interrupt = require('interrupt')
const Destructible = require('destructible')

class Conduit {
    static Error = Interrupt.create('Conduit.Error')

    constructor (destructible = new Destructible('conduit'), shifter, queue, responder) {
        this._destructible = destructible
        this._instance = 0
        this._identifier = 0n
        this._written = 0n
        this._read = 0n
        this._queues = {}
        this.promise = destructible.promise
        if (shifter && queue) {
            this.pump(shifter, queue, responder)
        }
    }

    destroy () {
        this._destructible.destroy()
    }

    pump (shifter, queue, responder) {
        // **TODO** Document the use of the responder function as a
        // `Destructible` monitored shifter function. It might reduce the number
        // of sub-destructibles in an application.
        async function respond (body, request) {
            const response = await responder(body.header, request.shifter, request.queue)
            if (!body.shifter) {
                request.queue.enqueue([ response, null ])
            }
        }
        this._queue = queue
        this._destructible.durable('queue', shifter.pump(async (entry) => {
            if (entry == null) {
                for (const key in this._queues) {
                    const split = key.split(':')
                    if (split[1] ==  'inbox') {
                        await this._receive({
                            module: 'conduit',
                            to: split[0],
                            method: 'envelope',
                            series: this._read,
                            identifier: split[2],
                            body: null
                        })
                        break
                    }
                }
                for (const key in this._queues) {
                    await this._queues[key].queue.shifter().end
                }
                this._queue.push(null)
            } else if (entry.module == 'conduit') {
                Conduit.Error.assert(this._read.toString(16) == entry.series, 'series.mismatch', {
                    read: this._read.toString(16),
                    written: this._written.toString(16),
                    entry: entry
                })
                this._read++
                switch (entry.to) {
                case 'server':
                    switch (entry.method) {
                    case 'connect':
                        const down = this._queues['server:outbox:' + entry.identifier] = new Queue
                        const request = { entry: entry, queue: down, shifter: null }
                        if (entry.queue) {
                            const up = new Queue
                            this._queues[`server:inbox:${entry.identifier}`] = up
                            request.shifter = up.shifter()
                        }
                        this._destructible.ephemeral([
                            'server', 'outbox', entry.identifier
                        ], request.queue.shifter().pump(async (subEntry) => {
                            if (subEntry == null) {
                                delete this._queues[`server:outbox:${entry.identifier}`]
                            }
                            this._queue.push({
                                module: 'conduit',
                                to: 'client',
                                method: 'envelope',
                                series: (this._written++).toString(16),
                                identifier: entry.identifier,
                                body: subEntry
                            })
                        }))
                        const instance = this._instance = (this._instance + 1) & 0xfffffff
                        this._destructible.ephemeral([
                            'request', entry.identifier
                        ], respond(entry.body, request))
                        break
                    case 'envelope':
                        const identifier = `server:inbox:${entry.identifier}`
                        this._queues[identifier].push(envelope.body)
                        if (envelope.body == null) {
                            delete this._queues[identifier]
                        }
                        break
                    }
                    break
                case 'client':
                    switch (entry.method) {
                    case 'envelope':
                        this._queues[`client:inbox:${entry.identifier}`].push(entry.body)
                        if (entry.body == null) {
                            delete this._queues[`client:inbox:${entry.identifier}`]
                        }
                    }
                    break
                }
            }
        }))
    }

    request (header, shifter = false, queue = false) {
        const identifier = (this._identifier++).toString(16)
        const inbox = this._queues[`client:inbox:${identifier}`] = new Queue
        const response = { queue: null, shifter: inbox.shifter() }
        const request = { header, shifter, queue }
        if (queue) {
            const outbox = this._queues[`client:outbox:${identifier}`] = response.queue = new Queue
            this._destructible.ephemeral([ 'client', 'outbox', indentifier ], (entry) => {
                if (entry == null) {
                    delete this._queues[`client:outbox:${identifier}`]
                } else {
                    Conduit.Error.assert(this._queues[`client:outbox:${identifier}`], 'missing.outbox')
                }
                this._queue.push({
                    module: 'conduit',
                    to: 'server',
                    method: 'envelope',
                    series: this._written = increment(this._written),
                    identifier: identifier,
                    body: envelope
                })
            })
        }
        this._queue.push({
            module: 'conduit',
            to: 'server',
            method: 'connect',
            series: (this._written++).toString(16),
            identifier: identifier,
            body: request
        })
        if (shifter || queue) {
            return response
        }
        const result = response.shifter.shift()
        result.then(() => response.shifter.destroy())
        return result
    }
}

module.exports = Conduit
