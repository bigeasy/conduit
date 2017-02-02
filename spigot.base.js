var Procession = require('procession')
var util = require('util')

function Spigot () {
    this.requests = new Procession
    this.responses = new Procession
}

Spigot.prototype.emptyInto = function (basin) {
    this.requests.pump(basin.requests)
    basin.responses.pump(this.responses)
}

module.exports = Spigot
