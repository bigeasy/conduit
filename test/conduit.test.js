describe('conduit', () => {
    const assert = require('assert')
    const Conduit = require('../conduit')
    const Destructible = require('destructible')
    const Queue = require('avenue')
    it('can invoke a function', async () => {
        const destructible = new Destructible('invoke')
        const server = new Conduit
        const from = new Queue
        const to = new Queue
        destructible.durable('server', server.pump(from.shifter(), to, async function (header) {
            return header.value
        }))
        destructible.destruct(() => server.destroy())
        const client = new Conduit
        destructible.durable('server', client.pump(to.shifter(), from))
        destructible.destruct(() => client.destroy())
        assert.equal(await client.request({ value: 1 }), 1, 'invoke')
        to.push(null)
        from.push(null)
    })
})
