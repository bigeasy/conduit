#!/usr/bin/env node

require('proof')(1, function (step, equal, deepEqual) {
    var conduit = require('../..'), fs = require('fs'), meow, child
    var callback = step()

    meow = conduit('node $1 a b c | filter(/^b$/.test($))')
    child = meow(__dirname + '/../echo.js')

    var output = []
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', function (data) { output.push(data) })
    child.on('exit', function () {
        equal(output.join(''), 'b\n', 'pipe')
    })
})
