var cadence = require('cadence')

function Delegate (delegate, method) {
    this._delegate = delegate
    this._method = method
    this.endOfStream = false
}

Delegate.prototype.invoke = cadence(function (async, envelope) {
    if (this.endOfStream) {
        return
    }
    if (envelope == null || envelope instanceof Error) {
        this.endOfStream = true
        async(function () {
            if (typeof this._delegate.destroy == 'function') {
                if (envelope == null) {
                    this._delegate.destroy(async())
                } else {
                    this._delegate.destroy(envelope, async())
                }
            }
        }, function () {
            return []
        })
    } else {
        this._delegate[this._method](envelope, async())
    }
})

module.exports = Delegate
