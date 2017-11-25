var stream = require('stream')
var Reader = require('interlocutor/reader')

function Response () {
    this.headers = null
    this.trailers = null
    this._trailers = null
    this.once('end', function () { this.trailers = this._trailers }.bind(this))
    Reader.call(this)
}
util.inherits(Response, Reader)

module.exports = Response
