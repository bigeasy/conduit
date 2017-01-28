var coalesce = require('nascent.coalesce')

function Prefixer (prefix) {
    this._prefix = coalesce(prefix, '_')
}

Prefixer.prototype.map = function (envelope) {
    return this._prefix + envelope.cookie
}

module.exports = Prefixer
