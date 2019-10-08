require('proof')(2, prove)

async function prove (okay) {
    const Consumer = require('../consumer')
    const stream = require('stream')
    {
        const through = new stream.PassThrough
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
        const consumer = new Consumer(through, 'conduit/consumer')
        await consumer.enqueue({})
        await consumer.enqueue({
            module: 'conduit/consumer',
            method: 'header',
            body: {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {}
            }
        })
        await consumer.enqueue({
            module: 'conduit/consumer',
            method: 'chunk',
            body: Buffer.from('hello, world')
        })
        await consumer.enqueue({
            module: 'conduit/consumer',
            method: 'trailer',
            body: { key: 'value' }
        })
    }
    {
        // Run again to cover null trailers.
        const through = new stream.PassThrough
        through.writeHead = function () {}
        through.addTrailers = function () { throw new Error }
        const consumer = new Consumer(through, 'conduit/consumer')
        await consumer.enqueue({})
        await consumer.enqueue({
            module: 'conduit/consumer',
            method: 'header',
            body: {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {}
            }
        })
        await consumer.enqueue({
            module: 'conduit/consumer',
            method: 'trailer',
            body: null
        })
    }
    {
        // Run again to cover empty trailers.
        const through = new stream.PassThrough
        through.writeHead = function () {}
        through.addTrailers = function () { throw new Error }
        const consumer = new Consumer(through, 'conduit/consumer')
        consumer.enqueue({})
        await consumer.enqueue({
            module: 'conduit/consumer',
            method: 'header',
            body: {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {}
            }
        })
        await consumer.enqueue({
            module: 'conduit/consumer',
            method: 'trailer',
            body: {}
        })
    }
}
