var stream = require('stream')
var Writer = require('interlocutor/writer')
var Response = require('./response')

function Responder (request) {
}

Responder.prototype.writeHead = function (statusCode, statusMessage, headers) {
    this._response = new Response(statusCode, statusMessage, headers)
    this._writer = new Writer(response)
    this._request.emit('response', this._response)
}

Responder.prototype.write = function (chunk, callback) {
    this._writer.write(chunk, callback)
}

Responder.prototype.addTrailers = function (trailers) {
    this._writer._reader._trailers = trailers
}

Responder.prototype.end = function () {
    this._writer.end()
}

module.exports = Responder
