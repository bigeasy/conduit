describe('conduit', () => {
    const assert = require('assert')
    const Conduit = require('../conduit')
    const Destructible = require('destructible')
    const Queue = require('avenue')
    it('can invoke a function', async () => {
        const destructible = new Destructible('promise')
        const from = new Queue
        const to = new Queue
        const server = new Conduit(destructible.durable('server'), from.shifter(), to, async function (header) {
            return header.value
        })
        const client = new Conduit(destructible.durable('client'), to.shifter(), from)
        assert.equal(await client.promise({ value: 1 }), 1, 'invoke')
        to.push(null)
        from.push(null)
        await destructible.promise
    })
    it('can receive a stream', async () => {
        const destructible = new Destructible('shifter')
        const from = new Queue
        const to = new Queue
        const server = new Conduit(destructible.durable('server'), from.shifter(), to, async function (header, queue) {
            await queue.enqueue([ header.value, null ])
        })
        const client = new Conduit(destructible.durable('client'), to.shifter(), from)
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
        const server = new Conduit(destructible.durable('server'), from.shifter(), to, async function (header, queue, shifter) {
            const [ value ] = await shifter.splice(2)
            await queue.enqueue([ value, null ])
        })
        const client = new Conduit(destructible.durable('client'), to.shifter(), from)
        const { queue, shifter } = client.queue(null)
        await queue.enqueue([ 1, null ])
        const [ value ] = await shifter.splice(2)
        assert.equal(value, 1, 'queue')
        to.push(null)
        from.push(null)
        await destructible.promise
    })
})
