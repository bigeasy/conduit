const assert = require('assert')

const { coalesce } = require('extant')
const Isochronous = require('isochronous')

class Ping {
    // **TODO** As a rule, we take ownership of our shifters.
    constructor (destructible, shifter, queue, options) {
        this._timeout = coalesce(options.timeout, 5000)
        this._lastPingAt = Date.now()

        const ping = coalesce(options.ping, this._timeout / 2)

        this._destructible = destructible

        this.destroyed = false
        destructible.destruct(() => this.destroyed = true)

        const isochronous = new Isochronous(ping, true, async () => {
            await queue.push({ module: 'conduit/ping', method: 'ping' })
            this._check(destructible)
        })
        destructible.durable('isochronous', isochronous.start())
        destructible.destruct(() => isochronous.stop())

        destructible.destruct(() => shifter.destroy())
        destructible.durable('shifter', this._pong(shifter))
    }

    _check (destructible) {
        if (Date.now() - this._lastPingAt > this._timeout) {
            destructible.destroy()
        }
    }

    async _pong (shifter) {
        for await (const envelope of shifter.iterator()) {
            assert(envelope.module === 'conduit/ping' && envelope.method === 'pong')
            this._lastPingAt = Date.now()
        }
    }
}

module.exports = Ping
