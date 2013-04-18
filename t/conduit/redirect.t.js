#!/usr/bin/env node

require('proof')(1, function (equal, deepEqual, step) {
  var conduit = require('../..'), fs = require('fs'), meow, child, callback = step();

  meow = conduit('cat < $1 > out.txt');
  child = meow(__filename);
  
  child.on('close', function () {
    equal(fs.readFileSync('out.txt', 'utf8'), fs.readFileSync(__filename, 'utf8'), 'copied');
    fs.unlinkSync('out.txt');
    callback();
  });
});