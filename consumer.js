var cadence = require('cadence')

function Consumer (delegate, module) {
    this._delegate = delegate
    this._module = module
}

Consumer.prototype.enqueue = cadence(function (async, envelope) {
    if (envelope == null || envelope.module != this._module) {
        return []
    }
    switch (envelope.method) {
    case 'header':
        this._delegate.writeHead(envelope.body.statusCode, envelope.body.statusMessage, envelope.body.headers)
        break
    case 'chunk':
        this._delegate.write(envelope.body, async())
        break
    case 'trailer':
        if (
            envelope.body != null &&
            Object.keys(envelope.body).length != 0
        ) {
            this._delegate.addTrailers(envelope.body)
        }
        this._delegate.end()
        break
    }
    return []
})

module.exports = Consumer
