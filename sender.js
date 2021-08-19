const Staccato = require('staccato')

const { coalesce } = require('extant')

module.exports = async function (message, read, module) {
    // **TODO** Replace with new Staccato.
    const staccato = new Staccato(message)
    for await (const buffer of staccato.readable) {
        await read.push({ module, method: 'chunk', body: buffer })
    }
    await read.push({
        module: module,
        method: 'trailer',
        body: coalesce(message.trailers)
    })
    await read.push(null)
}
