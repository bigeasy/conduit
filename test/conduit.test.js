describe('conduit', () => {
    const assert = require('assert')
    const Conduit = require('../conduit')
    const Destructible = require('destructible')
    const Queue = require('avenue')
    it('can invoke a function', async () => {
        const destructible = new Destructible('invoke')
        const from = new Queue
        const to = new Queue
        const server = new Conduit(destructible.durable('server'), from.shifter(), to, async function (header) {
            return header.value
        })
        const client = new Conduit(destructible.durable('client'), to.shifter(), from)
        assert.equal(await client.request({ value: 1 }), 1, 'invoke')
        to.push(null)
        from.push(null)
        await destructible.promise
    })
})
