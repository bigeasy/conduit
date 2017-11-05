require('proof')(2, require('cadence')(prove))

function prove (async, okay) {
    var Consumer = require('../consumer')
    var stream = require('stream')
    var through
    var consumer
    async(function () {
        through = new stream.PassThrough
        through.writeHead = function (statusCode, statusMessage, headers) {
            okay({
                statusCode: statusCode,
                statusMessage: statusMessage
            }, {
                statusCode: 200,
                statusMessage: 'OK'
            }, 'headers')
        }
        through.addTrailers = function (trailers) {
            okay(trailers, { key: 'value' }, 'trailers')
        }
        consumer = new Consumer(through, 'conduit/consumer')
        consumer.enqueue({}, async())
    }, function () {
        consumer.enqueue({
            module: 'conduit/consumer',
            method: 'header',
            body: {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {}
            }
        }, async())
    }, function () {
        consumer.enqueue({
            module: 'conduit/consumer',
            method: 'chunk',
            body: new Buffer('hello, world')
        }, async())
    }, function () {
        consumer.enqueue({
            module: 'conduit/consumer',
            method: 'trailer',
            body: { key: 'value' }
        }, async())
    }, function () {
        // Run again to cover null trailers.
        through = new stream.PassThrough
        through.writeHead = function () {}
        through.addTrailers = function () { throw new Error }
        consumer = new Consumer(through, 'conduit/consumer')
        consumer.enqueue({}, async())
    }, function () {
        consumer.enqueue({
            module: 'conduit/consumer',
            method: 'header',
            body: {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {}
            }
        }, async())
    }, function () {
        consumer.enqueue({
            module: 'conduit/consumer',
            method: 'trailer',
            body: null
        }, async())
    }, function () {
        // Run again to cover empty trailers.
        through = new stream.PassThrough
        through.writeHead = function () {}
        through.addTrailers = function () { throw new Error }
        consumer = new Consumer(through, 'conduit/consumer')
        consumer.enqueue({}, async())
    }, function () {
        consumer.enqueue({
            module: 'conduit/consumer',
            method: 'header',
            body: {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {}
            }
        }, async())
    }, function () {
        consumer.enqueue({
            module: 'conduit/consumer',
            method: 'trailer',
            body: {}
        }, async())
    })
}
