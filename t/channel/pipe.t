#!/usr/bin/env node

require('proof')(1, function (equal, deepEqual, callback) {
  var channel = require('../..'), fs = require('fs'), meow, child;

  meow = channel('node $1 a b c | node $2');
  child = meow(__dirname + '/../echo.js', __dirname + '/../cat.js');

  var output = [];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', function (data) { output.push(data) });
  child.on('exit', function () {
    equal(output.join(''), 'a\nb\nc\n', 'pipe');
  });
});
