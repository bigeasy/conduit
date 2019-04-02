var cadence = require('cadence')
var Staccato = require('staccato')
var coalesce = require('extant')

module.exports = cadence(function (async, message, read, module) {
    async(function () {
        var reader = new Staccato.Readable(message)
        async.loop([], function () {
            async(function () {
                reader.read(async())
            }, function (buffer) {
                if (buffer == null) {
                    reader.raise()
                    return [ async.break ]
                }
                read.enqueue({
                    module: module,
                    method: 'chunk',
                    body: buffer
                }, async())
            })
        })
    }, function () {
        read.enqueue({
            module: module,
            method: 'trailer',
            body: coalesce(message.trailers)
        }, async())
    }, function () {
        read.enqueue(null, async())
    }, function () {
        return []
    })
})
