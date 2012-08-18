var slice = conduit.call.bind([].slice)
  , fs = require('fs')
  , events = require('events')
  , util = require('util')
  , through = require('through')
  , children = require('child_process')
  ;

function Conduit () {
}

util.inherits(Conduit, events.EventEmitter);

function die () {
  console.log.apply(console, slice(arguments, 0));
  return process.exit(1);
}

function say () { return console.log.apply(console, slice(arguments, 0)) }

function extend (to, from) {
  for (var key in from) to[key] = from[key];
  return to;
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
function conduit (command) {
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

    var conduit = new Conduit();

    proc.on('exit', function () { conduit.emit('exit') });
    // TODO: Skip if redirected.
    conduit.stdout = proc.stdout;

    return conduit;
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

module.exports = conduit;
