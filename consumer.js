class Consumer {
    constructor (delegate, module) {
        this._delegate = delegate
        this._module = module
    }

    async enqueue (envelope) {
        if (envelope == null || envelope.module != this._module) {
            return []
        }
        switch (envelope.method) {
        case 'header':
            await this._delegate.writeHead(envelope.body.statusCode, envelope.body.statusMessage, envelope.body.headers)
            break
        case 'chunk':
            await this._delegate.write(envelope.body)
            break
        case 'trailer':
            if (
                envelope.body != null &&
                Object.keys(envelope.body).length != 0
            ) {
                await this._delegate.addTrailers(envelope.body)
            }
            await this._delegate.end()
            break
        }
    }
}

module.exports = Consumer
