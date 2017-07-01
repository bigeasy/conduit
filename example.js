

var conduit = new Conduit(input, output)
var server = new Server('server')
var responder = new Responder('responder')

server.connectTo(responder).connectTo(conduit)

conduit.connect(responder).connect(server).connect(client)

// Instead of piping, multiplexing. I've yet to have an application for
// filtering someone else's messages.

var router = new Router(conduit)

var server = {
    connect: function (socket) {
        var router = new Router(socket)
    }
}

var requester = new Filter(new Requester, { name: 'requester' })

var router = new Router

var conduit = new Conduit(input, output, router)

router.createRoute('assignation', new Server)
var route = router.createRoute('route', new Responder)

route.destroy()
route.autoClose = false // Remove from route when we see a null go by, can still
                        // go backward.

router.route('requester', requester)
router.route('responder', responder)
router.route('server', new Server(server, 'connect'))

conduit.route('requester', requester)
conduit.route('responder', responder)
conduit.route('server', responder)

conduit.route('colleague', this._responder = new Responder)
conduit.route('conference', this._colleague = new Requester)

conduit.route('assignation', this._envoy)
