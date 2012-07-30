var slice = channel.call.bind([].slice)
  , fs = require('fs')
  , EventEmitter = require('events').EventEmitter
  , through = require('through')
  , spawn = require('child_process').spawn
  ;

function extend (to, from) {
  for (var key in from) to[key] = from[key];
  return to;
}

// Bogus for now.
function okay (event, callback) { callback(0) }

function Channel (vargs) {
  Object.defineProperties(this,
  { 'read': { get: function () {
    // Have this be an error and send SIGPIPE.
      return { stdout: fs.createReadStream.apply(fs, vargs), on: okay }
    } }
  , write: { get: function () {
    // Have this be an error and send SIGPIPE.
      return { stdin: fs.createWriteStream.apply(fs, vargs), on: okay }
    } }
  , split: { get: function () {
      return function split (encoding, separator) {
        var remainder, encout = 'utf8';
        encoding = encoding || 'utf8';
        separator = separator || '\n';
        var pipe = through(function write (data) {
          var split = ((remainder || '') + data).split('\n');
          if (split.length == 1) remainder += split.pop()
          else remainder = split.pop();
          split.forEach(function (line) {
            var result = vargs[0](line);
            if (result != null) this.emit('data', new Buffer(result + separator, encout));
          }.bind(this));
        }, function end () {
          if (remainder) {
            var result = vargs[0](remainder);
            console.log('emit');
            this.emit('data', new Buffer(result, encout));
          }
          this.emit('end');
        });
        pipe.setEncoding = function (encoding) { encout = encoding };
        pipe.on('pipe', function (src) {
          src.setEncoding(encoding);
        });
        return extend(new EventEmitter(), { stdout: pipe, stdin: pipe });
      }
    } }
  , exec: { get: function () {
      return function () {
        return spawn.apply(spawn, [ vargs.shift(), vargs ])
      }
    } }
  , pipe: { get: function () {
      var codes = [], count = 0, events = new EventEmitter();
      events.stderr = through();
      vargs = vargs.map(function (arg) { return typeof arg == 'function' ? arg() : arg });
      for (var i = vargs.length - 1; i != -1; i--) {
        if (i > 0) vargs[i - 1].stdout.pipe(vargs[i].stdin);
        vargs[i].on('exit', (function (i) { return function (code) {
          codes[i] = code;
          if (++count == vargs.length) {
            process.nextTick(function () { events.emit('exit', codes) });
          }
        }})(i));
        if (vargs[i].stderr) {
          vargs[i].stderr.pipe(events.stderr);
        }
      }
      if (vargs[vargs.length - 1].stdout) {
        events.stdout = vargs[vargs.length - 1].stdout;
      }
      return events;
    } }
  });

  this.toArray = function () {
    var remainder
      , output = []
      , vargs1 = slice(arguments, 0)
      , callback = vargs1.pop()
      , encoding = vargs1.shift() || 'utf8'
      , separator = vargs1.shift() || '\n'
      ;
    var linear = through(function write (data) {
      var split = ((remainder || '') + data).split('\n');
      if (split.length == 1) remainder += split.pop()
      else remainder = split.pop();
      split.forEach(function (line) {
        if (line != null) output.push(line);
      });
    }, function end () {
      if (remainder) output.push(remainder);
      callback(null, output);
    });
    linear.on('pipe', function (src) {
      src.setEncoding(encoding);
    });
    linear.on('error', callback);
    this.pipe.stdout.pipe(linear);
  }
  return this;
}

// So.. We create an object, or a function with properties and we don't
// determine what the function is until a member is called.
function channel () {
  var channel;
  return channel = Channel.call(function (callback) {
    channel.pipe.on('exit', function (code) {
      if (code[code.length - 1]) callback(code);
      else callback();
    });
  }, slice(arguments, 0));
}

module.exports = channel;
