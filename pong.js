const assert = require('assert')

const { coalesce } = require('extant')

class Pong {
    constructor (destructible, shifter, queue, options) {
        this._timeout = coalesce(options.timeout, 5000)
        this._lastPingAt = Date.now()
        this._interval = setInterval(() => {
            this._check(destructible)
        }, this._timeout / 2)
        this.start = Date.now()
        destructible.destruct(() => clearInterval(this._interval))
        destructible.destruct(() => shifter.destroy())
        destructible.durable('shifter', this._pong(shifter, queue))
    }

    _check (destructible) {
        if (Date.now() - this._lastPingAt > this._timeout) {
            destructible.destroy()
        }
    }

    async _pong (shifter, queue) {
        for await (const envelope of shifter.iterator()) {
            assert(envelope.module === 'conduit/ping' && envelope.method === 'ping')
            this._lastPingAt = Date.now()
            await queue.push({ module: 'conduit/ping', method: 'pong' })
        }
    }
}

module.exports = Pong
