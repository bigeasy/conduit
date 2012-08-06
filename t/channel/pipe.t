#!/usr/bin/env node

require('proof')(1, function (equal, deepEqual, callback) {
  var channel = require('../..'), fs = require('fs'), meow, child;

  meow = channel('cat < $1 > out.txt');
  child = meow(__filename);
  
  child.on('exit', function () {
    equal(fs.readFileSync('out.txt', 'utf8'), fs.readFileSync(__filename, 'utf8'), 'copied');
    fs.unlinkSync('out.txt');
    callback();
  });
});
