var cadence = require('cadence')

function Delegate (delegate) {
    this._delegate = delegate
    this.endOfStream = false
}

Delegate.prototype.enqueue = cadence(function (async, envelope) {
    if (this.endOfStream) {
        return []
    }
    if (envelope == null || envelope instanceof Error) {
        this.endOfStream = true
    }
    this._delegate.enqueue(envelope, async())
})

module.exports = Delegate
