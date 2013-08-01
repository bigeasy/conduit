#!/usr/bin/env node

require('proof')(1, function (equal, deepEqual, step) {
    var fs          = require('fs')
    var conduit     = require('../..')

    var callback    = step()

    var meow, child

    meow = conduit('cat < $1 > out.txt')
    child = meow(__filename)
    
    child.on('close', function () {
        equal(fs.readFileSync('out.txt', 'utf8'), fs.readFileSync(__filename, 'utf8'), 'copied')
        fs.unlinkSync('out.txt')
        callback()
    })
})
