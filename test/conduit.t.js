require('proof')(4, async okay => {
    const Conduit = require('../conduit')
    const Destructible = require('destructible')
    const { Queue } = require('avenue')
    {
        const destructible = new Destructible('promise')
        const from = Conduit.queue(1024)
        const to = Conduit.queue(1024)
        const server = new Conduit(destructible.durable('server'), from.shifter(), to, async function (header) {
            return header.value
        })
        const client = new Conduit(destructible.durable('client'), to.shifter(), from)
        okay(await client.invoke({ value: 1 }), 1, 'invoke')
        destructible.destroy()
        to.push(null)
        await destructible.promise
    }
    {
        const destructible = new Destructible('shifter')
        const from = Conduit.queue(1024)
        const to = Conduit.queue(1024)
        const server = new Conduit(destructible.durable('server'), from.shifter(), to, async function (header, queue) {
            await queue.enqueue([ header.value, null ])
        })
        const client = new Conduit(destructible.durable('client'), to.shifter(), from)
        const { shifter } = await client.shifter({ value: 1 })
        const [ value ] = await shifter.splice(2)
        okay(value, 1, 'shifter')
        destructible.destroy()
        to.push(null)
        from.push(null)
        await destructible.promise
    }
    {
        const destructible = new Destructible($ => $(), 'queue')
        destructible.ephemeral('test', async () => {
            const from = new Queue
            const to = new Queue
            const server = new Conduit(destructible.durable('server'), from.shifter(), to, async function (header, queue, shifter) {
                const [ value ] = await shifter.splice(2)
                await queue.enqueue([ value, null ])
            })
            const client = new Conduit(destructible.durable('client'), to.shifter(), from)
            const { queue, shifter } = await client.queue(null)
            await queue.enqueue([ 1, null ])
            const [ value ] = await shifter.splice(2)
            okay(value, 1, 'queue')
            destructible.destroy()
            to.push(null)
            from.push(null)
        })
        await destructible.promise
    }
    {
        const destructible = new Destructible($ => $(), 'queue')
        const from = Conduit.queue(1024)
        const to = Conduit.queue(1024)
        const server = new Conduit(destructible.durable('server'), from.shifter(), to, async function (header, queue, shifter) {
            const values = await shifter.splice(2)
            if (values.length == 2) {
                await queue.enqueue([ values[0], null ])
            }
        })
        const client = new Conduit(destructible.durable('client'), to.shifter(), from)
        const { queue, shifter } = await client.queue(null)
        destructible.destroy()
        from.push(null)
        await destructible.promise
        okay(true, 'hangup')
    }
})
