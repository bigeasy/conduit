#!/usr/bin/env node

require('proof')(2, function (equal, deepEqual, callback) {
  var $ = require('../..'), fs = require('fs');
  $($(__filename).read, $('tee').exec, $('out.txt').write).pipe.on('exit', function (codes) {
    deepEqual([ 0, 0, 0 ], codes, 'codes all zero');
    equal(fs.readFileSync('out.txt', 'utf8'), fs.readFileSync(__filename, 'utf8'), 'copied');
    fs.unlinkSync('out.txt');
    callback();
  });
});
