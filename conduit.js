const assert = require('assert')

const { Queue } = require('avenue')
const { Transformer } = require('avenue/transformer')

// Detailed exceptions that can be caught by type.
const Interrupt = require('interrupt')

// A tree of cancellable strands.
const Destructible = require('destructible')

const { Future } = new require('perhaps')

const Verbatim = require('verbatim')

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

    static queue (max) {
        return new Queue(max, entry => {
            return entry != null ? entry.reduce((sum, buffer) => sum + buffer.length, 0) : 0
        })
    }

    constructor (destructible, shifter, queue, responder = null) {
        this.destructible = destructible

        this._shifter = shifter
        this._queue = queue
        this._responder = responder

        this.pumping = false
        this.destroyed = false

        this._instance = 0
        this._identifier = 0
        this._written = 0
        this._read = 0
        this._queues = {}

        this._sendable = this.destructible.durable('outboxes')

        const respondable = this.destructible.durable('responder')

        this.eos = new Future

        this.destructible.durable('shutdown', async () => {
            await this.eos.promise
            await this._sendable.done
            await respondable.done
            for (const key in this._queues) {
                this._queues[key].push(null)
            }
            this._queue.push(null)
        })

        // **TODO** Document the use of the responder function as a
        // `Destructible` monitored shifter function. It might reduce the number
        // of sub-destructibles in an application.
        // **TODO** Just use request.

        const respond = async (verbatim, { queue, shifter }) => {
            const response = await (this._responder)(verbatim.header, queue, shifter)
            if (! verbatim.shifter) {
                await queue.enqueue([ response, null ])
            }
        }

        const receive = async entry => {
            if (entry == null) {
                for (const key in this._queues) {
                    const split = key.split('.')
                    if (split[1] ==  'inbox') {
                        receive(this._serialize({
                            module: 'conduit',
                            to: split[0],
                            method: 'envelope',
                            series: this._read.toString(16),
                            identifier: +split[2],
                            forced: true
                        }, null))
                    }
                }
                this.destructible.destroy()
                this.eos.resolve()
            } else {
                const header = JSON.parse(String(entry.shift()))
                const verbatim = entry.length == 0 ? null : Verbatim.deserialize(entry)
                Conduit.Error.assert(this._read == header.series, 'series.mismatch', {
                    read: this._read.toString(16),
                    written: this._written.toString(16),
                    entry: entry
                })
                this._read++
                const { identifier } = header
                switch (header.to) {
                case 'server':
                    switch (header.method) {
                    case 'connect':
                        const request = { entry: entry, queue: null, shifter: null }
                        if (verbatim.queue) {
                            const up = new Queue
                            this._queues[`server.inbox.${identifier}`] = up
                            request.shifter = up.shifter()
                        }
                        let eos = false
                        request.queue = new Transformer(this._queue, body => {
                            assert(! eos)
                            eos = body == null
                            return this._serialize({
                                module: 'conduit',
                                to: 'client',
                                method: 'envelope',
                                series: this._written++,
                                identifier: header.identifier
                            }, body)
                        })
                        const instance = this._instance++
                        // **TODO** Wrap in `try`/`catch`? Actually, we should find a way to
                        // error out of the socket instead, shut it down, rather than try to
                        // recover an indivdiual queue.
                        //
                        // Not sure what the above is about. It is old.
                        //
                        // We defer the invocation of `respond` in case the destructible is
                        // shut down. If it is then an exception the promise returned from
                        // `respond` will not be handled because the ephemeral was never
                        // created.
                        respondable.ephemeral(`request.${identifier}`, () => respond(verbatim, request))
                        break
                    case 'envelope':
                        await this._queues[`server.inbox.${identifier}`].push(verbatim)
                        if (verbatim == null) {
                            delete this._queues[`server.inbox.${identifier}`]
                        }
                        break
                    }
                    break
                case 'client':
                    switch (header.method) {
                    case 'envelope':
                        await this._queues[`client.inbox.${identifier}`].push(verbatim)
                        if (verbatim == null) {
                            delete this._queues[`client.inbox.${identifier}`]
                        }
                    }
                    break
                }
            }
        }

        this.destructible.durable('queue', this._shifter.push(receive))
    }

    queue (header) {
        // would return shifter and queue
        return this._request(header, true, true)
    }

    shifter (header) {
        // would return shifter and no queue
        return this._request(header, true, false)
    }

    invoke (header) {
        // would return the first entry as a promise
        return this._request(header, false, false)
    }

    async _request (header, shifter, queue) {
        const identifier = this._identifier++
        const inbox = this._queues[`client.inbox.${identifier}`] = new Queue
        const response = { queue: null, shifter: inbox.shifter() }
        const request = { header, shifter, queue }
        if (queue) {
            let eos = false
            response.queue = new Transformer(this._queue, body => {
                assert(! eos)
                eos = body == null
                return this._serialize({
                    module: 'conduit',
                    to: 'server',
                    method: 'envelope',
                    series: this._written++,
                    identifier: identifier
                }, body)
            })
        }
        await this._queue.push(this._serialize({
            module: 'conduit',
            to: 'server',
            method: 'connect',
            series: this._written++,
            identifier: identifier
        }, request))
        // If they want a shifter, give them one. If they want a queue then they
        // are going to have to shift the response themselves.
        if (shifter || queue) {
            return response
        }
        return async function () {
            const result = await response.shifter.shift()
            response.shifter.destroy()
            return result
        } ()
    }

    _serialize (header, body) {
        const buffer = Buffer.from(JSON.stringify(header))
        if (body == null) {
            return [ buffer ]
        }
        return [ buffer ].concat(Verbatim.serialize(body))
    }
}

module.exports = Conduit
