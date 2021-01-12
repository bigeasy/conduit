var Staccato = require('staccato')
var coalesce = require('extant')

module.exports = async function (message, read, module) {
    // **TODO** Replace with new Staccato.
    const reader = new Staccato.Readable(message)
    for await (const buffer of reader) {
        await read.push({ module, method: 'chunk', body: buffer })
    }
    await read.push({
        module: module,
        method: 'trailer',
        body: coalesce(message.trailers)
    })
    await read.push(null)
}
