const conduit = new Conduit(async (header, queue, shifter) {
    switch (header.method) {
    case 'echo':
        return header.body
    case 'get':
        await queue.enqueue([ 1, 2, 3, null ])
        break
    }
})

const conduit = new Conduit

const promise = conduit.pump(queue, shifter, async (header, queue, shifter) {
    switch (header.method) {
    case 'invoke':
        return header.value
    case 'stream':
        for await (const entries of shifter.iterator(256)) {
            await queue.enqueue(entries)
        }
        queue.push(null)
        break
    }
})

for await (const { request, queue, header } of conduit.pump(queue, shifter)) {
    switch (header.method) {
    }
}

const result = await conduit.request({ method: 'invoke', value: 1 })
const { queue, shifter } = conduit.request({ method: 'invoke', value: 1 })
await queue.enqueue([ 1, null ])
const result = await shifter.shift()
assert.equal(await shifter.shift(), null)

const promise = conduit.pump(queue, shifter)

const request = conduit.request({ method: 'get' }, true)

for await (const number of request.shifter) {
    console.log(number)
}

await promise
