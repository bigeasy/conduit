function Request (read) {
    this._read = read
    this.once('finish', this._finish.bind(this))
}
util.inherits(Request, stream.Writable)

Request.prototype.abort = function () {
    this.emit('abort')
    this.aborted = Date.now()

    this._read.push({
        module: 'conduit/requester',
        method: 'abort',
        body: null
    })
}

Request.prototype._write = cadence(function (async, chunk, encoding) {
    if (this.aborted != null) {
        this._read.enqueue({
            module: 'conduit/requester',
            method: 'chunk',
            body: chunk
        }, async())
    }
})

Request.prototype._finish = function () {
    read.push({
        module: module,
        method: 'trailer',
        body: null
    })
    read.push(null)
}
