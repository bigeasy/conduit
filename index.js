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


function Channel () {
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
  var encout, self = this;
  return function (vargs) {
    var ee, remainder, pipe = through(function write (data) {
      var split = ((remainder || '') + data).split('\n');
      if (split.length == 1) remainder += split.pop()
      else remainder = split.pop();
      split.forEach(function (line) {
        vargs[0] = line;
        var result = filter.call(self, vargs);
        if (result != null) this.emit('data', encout == 'utf8' ? result + '\n' :  new Buffer(result + '\n', 'utf8'));
      }.bind(this));
    }, function end () {
      var result;
      vargs[0] = remainder;
      if (remainder && (result = filter.apply(self, remainder)) != null) {
        this.emit('data', encout == 'utf8' ? result : new Buffer(result, 'utf8'));
      }
      this.emit('end');
    });
    extend(pipe, { setEncoding:  function (encoding) { encout = encoding } });
    ee = extend(new events.EventEmitter(), { stdin: pipe
                                    , stdout: pipe
                                    , encoding: 'utf8'
                                    , javascript: true
                                    });
    return ee;
  }
}

Object.defineProperties({},
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
{ call: function () {
    var vargs = slice(arguments), callback = vargs.pop();
    if (vargs[0] && Array.isArray(vargs[0])) {
    } else {
    }
  }
};
var _prototype =
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

util.inherits(Channel, events.EventEmitter);

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
var DIRECTION = 
{ '<': [ '<' ]
, '>': [ '>' ]
, '|': [ '|' ]
};

var GROUPING =
{ '(': [ '(' ]
, ')': [ ')' ]
, ',': [ ',' ]
};

var SYMBOL = {};
var SYMBOL = extend(SYMBOL, DIRECTION);
var SYMBOL = extend(SYMBOL, GROUPING);
var SYMBOL = extend(SYMBOL, { '$': [ '$' ] });

var utilties = 
{ filter: function (regex) {
    return gatherer(function filter (vargs) {
      var outcome = regex.apply(this, vargs);
      if (outcome instanceof RegExp) {
        regex = function ($) { return outcome.test($) }
        return filter.call(this, vargs);
      } else if (outcome) {;
        return vargs[0];
      }
    })
  } 
, reject: function (regex) {
    return gatherer(function filter (vargs) {
      var outcome = regex.apply(this, vargs);
      if (outcome instanceof RegExp) {
        regex = function ($) { return outcome.test($) }
        return filter.call(this, vargs);
      } else if (!outcome) {;
        return vargs[0];
      }
    })
  } 
};

function symbol (token) {
  if (Array.isArray(token)) return token[0];
}

function parameters (node, tokens) {
  while (tokens.length) {
    switch (symbol(tokens[0])) {
    case ')':
      tokens.shift();
      return;
    case ',':
      tokens.shift();
      break;
    default:
      node.parameters.push(tokens.shift());
    }
  }
}

function parse (args) {
  var node;
  switch (symbol(args[0])) {
  default:
    node = { command: args.shift(), parameters: [] };
    while (args.length && !symbol(args[0])) {
      node.parameters.push(args.shift());
    }
    if (symbol(args[0]) == '(') {
      node.javascript = true;
      args.shift();
      parameters(node, args);
    } else {
      if (symbol(args[0]) == '<') {
        node.input = args.splice(0, 2).pop();
      }
      if (symbol(args[0]) == '>') {
        node.output = args.splice(0, 2).pop();
      } else if (symbol(args[0]) == '|') {
        args.shift();
        node.next = parse(args);
      }
    }
  }
  return node;
}

function funcify (string) {
  var f = [ '$' ], position = 0, i;
  string.replace(/\$(\d+)/, function (_, pos) { position = Math.max(position, pos) });
  for (i = 0; i < position; i++) {
    f.push('$' + (i + 1));
  }
  f.push('return ' + string);
  return Function.apply(Function, f);
}

function invoke (node, vargs) {
  var command = node.command.apply(this, vargs), parameters, pipe;
  if (node.javascript) {
    //die(node.parameters.toString());
    //parameters = node.parameters.map(function (parameter) {
    //  return parameter.apply(parameter, vargs);
    //});
    pipe = utilties[command].apply(this, node.parameters);
    pipe = pipe.call(this, vargs);
  } else {
    parameters = node.parameters.map(function (parameter) {
      return parameter.apply(this, vargs);
    });
    pipe = children.spawn(command, parameters);
  }
  if (node.input) {
    var input = fs.createReadStream(node.input.apply(this, vargs));
    input.pipe(pipe.stdin);
  }

  if (node.output) {
    var output = fs.createWriteStream(node.output.apply(this, vargs));
    pipe.stdout.pipe(output);
  }

  if (node.next) {
    var next = invoke(node.next, vargs);
    if (next.encoding) {
      pipe.stdout.setEncoding(next.encoding);
    }
    if (next.javascript) {
      pipe.on('exit', function (code) { next.emit('exit', code) });
    }
    pipe.stdout.pipe(next.stdin);
    pipe = next;
  }

  return pipe;
}

// Wow, you know, if you can't figure out a stack trace, that's fine, you
// probably shouldn't be programming. I'm thinking about how in Java I'd always
// generate an exception at the point where it errored so people wouldn't get
// confused looking for it, but if you put the error generation in a function,
// it is easy to trace things through the stack.

// Standard error is one common pipe, unless a process invocation specifies a
// redirection.
function channel (command) {
  var args = [], rest = command, $, index = 0, part, string = [], tokens = []
    , call = 0, sub = 0, stack = [ '' ], join;
  while (rest) {
    $ = /^(\s*)(.*)$/.exec(rest), index += $[1].length, rest = $[2];
    $ = /^((?:[^,\\'"\s\/()$]|\\.|(["'])(?:[^\\\1]|\\.)*\2)*)(.*)/.exec(rest);
    if (!$) throw error(index);
    part = $[1], rest = $[3];
    if (!string.length && ($ = DIRECTION[part])) {
      tokens.push($);
    } else {
      if (stack[0]) {
        join = '';
        string.push(part);
      } else {
        join = ' + ';
        part.replace(/([^"']*)(?:(?:(["'])(?:[^\\\1]|\\.)*\1|\\.)([^"']*))?/g, function ($, before, quoted, after) {
          if (before) quote(before);
          if (quoted) {
            quoted = quoted[0] == '\\' ? quoted[1]
                                       : quoted.slice(1, quoted.length - 1).replace(/\\(.)/g, "$1");
            quote(quoted);
          }
          if (after) quote(after);
        });
      }
      if ($ = /^(\$\d+)(.*)$/.exec(rest)) {
        string.push($[1]), rest = $[2];
      }
      if (stack[0]) {
        if (stack[0] == rest[0]) {
          if (rest[0] == ')') call--;
          if (call) {
            if (rest[0] == '(') call++;
            string.push(rest[0]), rest = rest.substring(1);
          } else {
            token(SYMBOL[rest[0]]), rest = rest.substring(1);
          }
        } else {
          if (rest[0] == '(') call++;
          string.push(rest[0]), rest = rest.substring(1);
        }
      } else if (/^\s/.exec(rest)) {
        token(); 
      } else if ($ = /^(,)(.*)$/.exec(rest)) {
        if (call) {
          token(SYMBOL[$[1]]), rest = $[2];
        } else {
          quote($[1]), rest = $[2];
        }
      } else if ($ = /^(\$)(.*)$/.exec(rest)) {
        quote($[1]), rest = $[2];
      } else if ($ = /^(\()(.*)$/.exec(rest)) {
        token(SYMBOL[$[1]]), rest = $[2];
        call++;
      } else if ($ = /^(\))(.*)$/.exec(rest)) {
        token(SYMBOL[$[1]]), rest = $[2];
        call--;
      } else if (call && ($ = /^(\/)(.*)$/.exec(rest))) {
        if (!string.length) {
          string.push($[1]); 
          stack.unshift(')');
          rest = $[2];
          join = '';
        }
      }
    }
  }

  if (string.length) token();
  tokens = tokens.map(function (token) { return Array.isArray(token) ? token : funcify(token) });

  var node = parse(tokens);
  return function () {
    var vargs = [ (void(0)) ].concat(slice(arguments));

    var proc = invoke(node, vargs);

    var channel = new Channel();

    proc.on('exit', function () { channel.emit('exit') });
    // TODO: Skip if redirected.
    channel.stdout = proc.stdout;

    return channel;
  }

  function quote (unquoted) {
    string.push(JSON.stringify(unquoted));
  }

  function token () {
    tokens.push(string.splice(0).join(join));
    tokens.push.apply(tokens, arguments);
  }

  function error (index) { return new Error("invalid syntax at: " + index) }
}

module.exports = channel;
