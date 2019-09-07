describe('conduit', () => {
    const assert = require('assert')
    const Conduit = require('../conduit')
    const Destructible = require('destructible')
    const Queue = require('avenue')
    it('can invoke a function', async () => {
        const destructible = new Destructible('promise')
        const from = new Queue
        const to = new Queue
        const server = new Conduit('server', from.shifter(), to, async function (header) {
            return header.value
        })
        destructible.durable('server', server.pump())
        const client = new Conduit(destructible.durable('client'), to.shifter(), from)
        destructible.durable('client', client.pump())
        assert.equal(await client.invoke({ value: 1 }), 1, 'invoke')
        to.push(null)
        from.push(null)
        await destructible.promise
    })
    it('can receive a stream', async () => {
        const destructible = new Destructible('shifter')
        const from = new Queue
        const to = new Queue
        const server = new Conduit('server', from.shifter(), to, async function (header, queue) {
            await queue.enqueue([ header.value, null ])
        })
        destructible.durable('server', server.pump())
        const client = new Conduit('client', to.shifter(), from)
        destructible.durable('client', client.pump())
        const { shifter } = client.shifter({ value: 1 })
        const [ value ] = await shifter.splice(2)
        assert.equal(value, 1, 'shifter')
        to.push(null)
        from.push(null)
        await destructible.promise
    })
    it('can send a stream', async () => {
        const destructible = new Destructible('queue')
        const from = new Queue
        const to = new Queue
        const server = new Conduit('server', from.shifter(), to, async function (header, queue, shifter) {
            const [ value ] = await shifter.splice(2)
            await queue.enqueue([ value, null ])
        })
        destructible.durable('server', server.pump())
        const client = new Conduit('client', to.shifter(), from)
        destructible.durable('client', client.pump())
        const { queue, shifter } = client.queue(null)
        await queue.enqueue([ 1, null ])
        const [ value ] = await shifter.splice(2)
        assert.equal(value, 1, 'queue')
        to.push(null)
        from.push(null)
        await destructible.promise
    })
    it('can hangup on a stream', async () => {
        const destructible = new Destructible('queue')
        const from = new Queue
        const to = new Queue
        const server = new Conduit('server', from.shifter(), to, async function (header, queue, shifter) {
            const values = await shifter.splice(2)
            if (values.length == 2) {
                await queue.enqueue([ values[0], null ])
            }
        })
        destructible.durable('server', server.pump())
        const client = new Conduit(500, 'client', to.shifter(), from)
        destructible.durable('client', client.pump())
        const { queue, shifter } = client.queue(null)
        from.push(null)
        await destructible.promise
    })
})
