#!/usr/bin/env node

require('proof')(1, function (equal, deepEqual, callback) {
  var channel = require('../..'), fs = require('fs');
  channel(__filename).read._('tee').exec.write('out.txt').on('close', function () {
    equal(fs.readFileSync('out.txt', 'utf8'), fs.readFileSync(__filename, 'utf8'), 'copied');
    fs.unlinkSync('out.txt');
    callback();
  });
});
