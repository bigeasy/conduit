function Header (request) {
    this.httpVersion = request.httpVersion
    this.method = request.method
    this.url = request.url
    this.headers = JSON.parse(JSON.stringify(request.headers))
    this.rawHeaders = request.rawHeaders ? JSON.parse(JSON.stringify(request.rawHeaders)) : null
}

Header.prototype.addHTTPHeader = function (name, value) {
    this.headers[name] = value
    if (this.rawHeaders != null) {
        this.rawHeaders.push(name, value)
    }
}

Header.prototype.toJSON = function () {
    const { httpVersion, method, url, headers, rawHeaders } = this
    return { httpVersion, method, url, headers, rawHeaders }
}

module.exports = Header
