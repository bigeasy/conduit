const Destructible = require('destructible')

class Flood {
    constructor (responder) {
        this._responder = responder
        this._destructible = new Destructible('spread')
        this.promise = this._destructible.promise
    }

    destroy () {
        this._destructible.destroy()
    }

    async _respond (responder, request) {
        const { entry, shifter, queue } = request
        if (entry.body.shifter || entry.body.queue) {
            await responder(entry.body.header, shifter, queue)
        } else {
            await queue.enqueue([ await responder(entry.body.header, null, null), null ])
        }
    }

    respond (request) {
        const key = [ 'request', request.entry.identifier ]
        this._destructible.ephemeral(key, this._respond(this._responder, request))
    }
}

module.exports = Flood
