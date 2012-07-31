var slice = channel.call.bind([].slice)
  , fs = require('fs')
  , events = require('events')
  , util = require('util')
  , through = require('through')
  , children = require('child_process')
  ;

function die () {
  console.log.apply(console, slice(arguments, 0));
  return process.exit(1);
}

function say () { return console.log.apply(console, slice(arguments, 0)) }

function extend (to, from) {
  for (var key in from) to[key] = from[key];
  return to;
}

// Bogus for now.
function okay (event, callback) { callback(0) }


function Channel (stdin, stderr, vargs) {
  this._stdin = stdin;
  this._stderr = stderr;
  this._vargs = vargs;
}

function Continuable (stdout, stderr) {
  this.stdout = stdout;
  this.stderr = stderr;
}

Continuable.prototype =
{ _: function () {
    return new Channel(this.stdout, this.stderr, slice(arguments, 0));
  }
, write: function () {
    var vargs = slice(arguments, 0);
    var writable = fs.createWriteStream.apply(fs, vargs)
    this.stdout.pipe(writable);
    return writable;
  }
, grep: function (regex) {
    var pipe = gatherer(function (line) { if (regex.test(line)) return line })
    this.stdout.setEncoding('utf8');
    this.stdout.pipe(pipe);
    return new Continuable(pipe, this._stderr);
  }
, edit: function (pattern, replacement) {
    var pipe = gatherer(function (line) { return line.replace(pattern, replacement) })
    this.stdout.setEncoding('utf8');
    this.stdout.pipe(pipe);
    return new Continuable(pipe, this._stderr);
  }
, call: function () {
    var vargs = slice(arguments, 0), callback = vargs.pop(), pipe, output = [];
    this.stdout.setEncoding('utf8');
    if (Array.isArray(vargs[0])) {
      pipe = gatherer(function (line) { output.push(line) });
      pipe.on('end', function () { callback(null, output) });
      pipe.setEncoding('utf8');
    } else {
      var pipe = through(function data (data) {
        output.push(data); 
      }, function end () {
        callback(null, output.join(''));
      });
    }
    this.stdout.pipe(pipe);
  }
}

function gatherer (filter) {
  var encout;
  var remainder, pipe = through(function write (data) {
    var split = ((remainder || '') + data).split('\n');
    if (split.length == 1) remainder += split.pop()
    else remainder = split.pop();
    split.forEach(function (line) {
      var result = filter(line);
      if (result != null) this.emit('data', encout == 'utf8' ? result + '\n' :  new Buffer(result + '\n', 'utf8'));
    }.bind(this));
  }, function end () {
    var result;
    if (remainder && (result = filter(remainder)) != null) {
      this.emit('data', encout == 'utf8' ? result : new Buffer(result, 'utf8'));
    }
    this.emit('end');
  });
  pipe.setEncoding = function (encoding) { encout = encoding };
  return pipe;
}

util.inherits(Channel, events.EventEmitter);

Object.defineProperties(Channel.prototype,
{ read: {
    get: function () {
    }
  }
, write: { get: function () {
  // Have this be an error and send SIGPIPE.
    return { stdin: fs.createWriteStream.apply(fs, vargs), on: okay }
  } }
, split: { get: function () {
    return function split (encoding, separator) {
      var remainder, encout = 'utf8';
      encoding = encoding || 'utf8';
      separator = separator || '\n';
      return extend(new EventEmitter(), { stdout: pipe, stdin: pipe });
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

Channel.prototype =
{ toArray: function () {
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
, get exec () {
    var args = [];
    this._vargs.forEach(function (arg) {
      if (Array.isArray(arg)) {
        args.push.apply(args, arg);
      } else {
        args.push.apply(args, Array.isArray(arg) ? arg : parse(arg));
      }
    });
    var child = children.spawn.apply(children, [ args.shift(), args ])
    if (this._stdin) this._stdin.pipe(child.stdin);
    child.stderr.pipe(this._stderr);
    return new Continuable(child.stdout, this._stderr);
  }
, get read () {
    return new Continuable(fs.createReadStream.apply(fs, this._vargs), this._stderr);
  }
}

function parse (arg) {
  var args = [];
  arg.replace(/(?:[^\\'"\s]|\\.|(["'])(?:[^\\\1]|\\.)*\1)+/g, function (arg) {
    args.push(arg.replace(/(?:(["'])(?:[^\\\1]|\\.)*\1|\\.)/g, function (arg) {
      if (arg[0] == '\\') return arg[1];
      else return arg.slice(1, arg.length - 1).replace(/\\(.)/g, "$1"); 
    }));
  }); 
  return args;
}

// How do we do SIGPIPE?

// Standard error is one common pipe, unless a process invocation specifies a
// redirection.
function channel () {
  var stderr = through(function data (data) {
    this.emit('data', data);
  }, function end () {
    this.emit('end');
  });
  return new Channel(null, stderr, slice(arguments, 0));
}

module.exports = channel;
