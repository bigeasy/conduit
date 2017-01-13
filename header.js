function Header () {
    this._lines = []
    this.object = null
}

Header.prototype._json = function (json) {
    try {
        return JSON.parse(json)
    } catch (e) {
        return null
    }
}

Header.prototype.parse = function (buffer, start, end) {
    var parsed = this._parse(buffer, start, end)
    this.object = parsed.object
    return parsed.start
}

Header.prototype._parse = function (buffer, start, end) {
    for (var i = start; i < end; i++) {
        if (buffer[i] == 0xa) {
            this._lines.push(buffer.toString('utf8', start, i))
            return {
                start: i + 1,
                object: this._json(this._lines.join(''))
            }
        }
    }
    this._lines.push(buffer.toString('utf8', start, end))
    return { start: end }
}

module.exports = Header
