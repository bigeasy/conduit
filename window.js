// An `async`/`await` message queue.
const { Queue } = require('avenue')

// Return the first not null-like value.
const { coalesce } = require('extant')

const Interrupt = require('interrupt')

const logger = require('prolific.logger').create('conduit.window')

class Window {
    static Error = Interrupt.create('Window.Error')

    constructor (destructible, options = {}) {
        this.outbox = new Queue
        this.inbox = new Queue

        this._expected = 0
        this._sequence = -1

        this._window = coalesce(options.window, 64)

        this._flush = this._window

        this.destroyed = false

        this.destructible = destructible

        destructible.durable('outbox', this._send(this.outbox.shifter()))

        this._queue = new Queue

        const queue = new Queue

        this._connection = {
            queue: queue,
            shifter: queue.shifter(),
            destructible: this.destructible.ephemeral('connection.0'),
            instance: 0
        }
        this._reservoir = this._queue.shifter()

        this._id = coalesce(options.id)

        logger.trace('created', { id: this._id })
    }

    async connect (shifter, queue) {
        // **TODO** Will this emit a null?
        this._connection.shifter.destroy()
        this._connection.destructible.destroy()
        await this._connection.destructible.promise
        const instance = ++this._connection.instance
        const destructible = this.destructible.ephemeral(`connection.${instance}`)
        destructible.durable('queue', this._receive(shifter))
        const _shifter = this._queue.shifter()
        destructible.durable('shifter', _shifter.push(24, queue.enqueue.bind(queue)))
        const reservoir = this._reservoir
        this._reservoir = this._queue.shifter()
        const resubmission = []
        for (const entry of reservoir.sync.iterator()) {
            resubmission.push(entry)
        }
        this._queue.enqueue(resubmission)
        this._connection = { shifter: _shifter, queue, destructible, instance }
    }

    // We can shutdown our side of the window by running null through the
    // window's outbox. The other side can shutdown down the inbox during normal
    // operation, but if the connection to the other side is cut and not coming
    // back, we need to be able to send a wrapped end of stream through the
    // inbox. We don't have the counter on the the ohter side and our Procession
    // queues are generally opaque, so we don't want to poke around in them for
    // a counter.
    //
    // Thus, this is a way to hangup the inbox, but let's call it truncate.

    // We need a hangup because we are resisting shutting down due to end of
    // stream and rejecting messages that are out of order. We'd need to put an
    // envelope with a `null` body right at the of the stream with the correct
    // sequence. The queue doesn't really have a good way of looking at the
    // input end, maybe it does, but I haven't used it. Could use it, it's just
    // the head of the inbox, but we're filtering the inbox for our specific
    // envelopes still, so we're not expecting the inbox to contain only content
    // related to us, so we have to scan the inbox. Forget that. Let's just have
    // a special control message.
    drain () {
        this._draining = true
        if (this._connection.destructible.destroyed) {
            this.inbox.push(null)
        }
    }

    // Why does reconnect work? Well, one side is going to realize that the
    // connection is broken and close it. If it is the client side then it will
    // open a new connection and the server will know to replace it. It will
    // destroy its Conduit and give the window to a new conduit. It will then
    // send the reconnect message (or rebuffer or something) and the client will
    // reply.
    //
    // If the server detects disconnection, then the client might keep on
    // chatting with a half-open socket indefinately. We might want to add a
    // keep-alive receiver that will destroy the socket, or we might decide to
    // add keep-alive to this here, splitting it out only if we decide that we
    // want to have alternative flow-control methods.
    //
    // Actually, for now we could have keep-alive as a seprate receiver. It has
    // a Signal you can wire to destroy your Conduit. Simpler and we can
    // optimize it away if it is too expensive. (Rather optimize Procession so
    // we're not shy about creating pipelines.)
    //
    // Anyway, with a keep-alive, the server can disconnect and just chill. The
    // client can timeout and then go through the reconnect. It is not going to
    // empty it's queue until it gets a flush and it won't get one off the
    // closed socket.

    //
    async _receive (shifter) {
        for await (const envelope of shifter.iterator()) {
        console.log('receiving')
            console.log('receiving', envelope)
            switch (envelope.method) {
            case 'envelope':
                // If we've seen this one already, don't bother.
                if (this._expected > envelope.sequence) {
                    break
                }
                Window.Error.assert(this._expected == envelope.sequence, 'ahead', {
                    id: this._id,
                    expected: this._expected,
                    connection: this._connection.instance,
                    envelope: envelope
                })
                // Send a flush if we've reached the end of a window.
                if (this._expected == this._flush) {
                    this._connection.queue.push({
                        module: 'conduit/window',
                        method: 'flush',
                        sequence: this._expected
                    })
                    this._flush = this._flush + this._window
                    logger.trace('flush', {
                        id: this._id,
                        connection: this._connection.instance,
                        sequence: this._expected,
                        flush: this._flush
                    })
                }
                // Set the new expected sequence.
                this._expected = String(BigInt(this._expected) + 1n)
                // Forward the body which might actually be `null` end-of-stream.
                await this.inbox.push(envelope.body)
                break
            case 'flush':
                // Shift the messages that we've expected off of the reservoir.
                logger.trace('flushing', {
                    id: this._id,
                    instance: this._connection.instance,
                    $envelope: envelope
                })
                for (;;) {
                    const peek = this._reservoir.peek()
                    // TODO `peek` should never be `null`.
                    Window.Error.assert(peek != null, 'null peek on flush')
                    if (peek.sequence == envelope.sequence) {
                        break
                    }
                    this._reservoir.shift()
                }
                break
            }
        }
        console.log('exit')
        this._connection.destructible.destroy()
        if (this._draining) {
            this.inbox.push(null)
        }
    }

    // Input into window from nested listener. It is wrapped in an envelope and
    // added to a queue.
    //
    // TODO Place a nested `null` here. You may want to assert that you've
    // shutdown the Window with a guard, or you can start to destroy the Window.
    // Are end-of-stream and destruction separate concerns? Probably not, no.
    //
    async _send (shifter) {
        for await (const envelope of shifter.iterator()) {
            console.log('sending', envelope)
            this._queue.push({
                module: 'conduit/window',
                method: 'envelope',
                sequence: this._sequence = String(BigInt(this._sequence) + 1n),
                body: envelope
            })
        }
        this._queue.push(null)
    }
}

module.exports = Window
