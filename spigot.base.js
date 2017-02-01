var Procession = require('procession')
var util = require('util')

function Spigot () {
    this.requests = new Procession
}

Spigot.prototype.emptyInto = function (basin) {
    this.requests.pump(basin)
    basin.responses.pump(this)
}

module.exports = Spigot
