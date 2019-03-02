require('proof')(4, prove)

function prove (assert) {
    var Header = require('../header')
    var header = new Header({
        httpVersion: '1.1',
        method: 'GET',
        url: '/index.html',
        headers: {}
    })
    header.addHTTPHeader('key', 'value')
    assert(header.headers, {
        key: 'value'
    }, 'add header no raw headers')
    assert(header.rawHeaders, null, 'null raw header no raw headers')
    var header = new Header({
        httpVersion: '1.1',
        method: 'GET',
        url: '/index.html',
        headers: {},
        rawHeaders: []
    })
    header.addHTTPHeader('key', 'value')
    assert(header.headers, {
        key: 'value'
    }, 'add header has raw headers')
    assert(header.rawHeaders, [
        'key', 'value'
    ], 'add raw header has raw headers')
}
