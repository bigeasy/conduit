// Required libraries.
var fs = require('fs')
var events = require('events')
var through = require('through')
var children = require('child_process')

// Create a slice function that will accept an array as its first argument.
var slice = conduit.call.bind([].slice)

// Debugging utility functions. If you do not see these functions used in the
// software below, it must be bug free.

// Display a message on the console and exit immediately.
function die () {
    console.log.apply(console, slice(arguments, 0))
    process.exit(1)
}

// Display a message on the console.
function say () { console.log.apply(console, slice(arguments, 0)) }

// Our Conduit class constructor. A `Conduit` is an `EventEmitter`.
function Conduit () { }
require('util').inherits(Conduit, events.EventEmitter)

// Copy the key/values in the from object into the to object.
function extend (to, from) {
    for (var key in from) to[key] = from[key]
    return to
}

// Create a function that will wrap a filter in an object that exposes the API
// of a child process according to the Node.js `child_process` model. The
// pseudo-process will gather up pseudo `STDIN` content line by line and pass
// each line through a filter function. The result of the filter function for
// each line is forwarded to `STDOUT`. If the filter function returns `null`,
// then nothing is forwarded to `STDOUT` for that line.

// This function will used to implement a number of planned default utility
// functions, including analogs for UNIX `grep` and `sed`.
function gatherer (filter) {
    var encout, gatherer = this
    return function (vargs) {
        var ee, remainder
        var pipe = through(function write (data) {
            var split = ((remainder || '') + data).split('\n')
            if (split.length == 1) remainder += split.pop()
            else remainder = split.pop()
            split.forEach(function (line) {
                vargs[0] = line
                var result = filter.call(gatherer, vargs)
                if (result != null) {
                    this.emit('data', encout == 'utf8' ? result + '\n'
                                                                                          : new Buffer(result + '\n', 'utf8'))
                }
            }.bind(this))
        }, function end () {
            var result
            vargs[0] = remainder
            if (remainder && (result = filter.apply(gatherer, remainder)) != null) {
                this.emit('data', encout == 'utf8' ? result : new Buffer(result, 'utf8'))
            }
            this.emit('end')
        })
        extend(pipe, { setEncoding:  function (encoding) { encout = encoding } })
        ee = extend(new events.EventEmitter(), {
            stdin: pipe,
            stdout: pipe,
            encoding: 'utf8',
            javascript: true
        })
        return ee
    }
}

// TODO: How do we do SIGPIPE?
var DIRECTION = { '<': [ '<' ] , '>': [ '>' ] , '|': [ '|' ] }
var GROUPING =  { '(': [ '(' ] , ')': [ ')' ] , ',': [ ',' ] }

// A collection of all symbols in the Conduit language.
var SYMBOL = {}

SYMBOL = extend(SYMBOL, DIRECTION)
SYMBOL = extend(SYMBOL, GROUPING)
SYMBOL = extend(SYMBOL, { '$': [ '$' ] })

// JavaScript commands for use in pipelines.
var utilties = {
    // Two slightly different version of the same function, a `grep` and a negated
    // `grep`. These functions expect a function that will return true, or else
    // return a regular expression. If someone defines a JavaScript command that
    // contains only a regular expression, and no call to the `test` function of
    // the regular expression, the function generated from the Conduit language
    // will return the regular expression. In this case, we wrap regular
    // expression in a function that calls test.

    // Include all lines that match the regular expression or function.
    filter: function (regex) {
        return gatherer(function filter (vargs) {
            var outcome = regex.apply(this, vargs)
            if (outcome instanceof RegExp) {
                regex = function ($) { return outcome.test($) }
                return filter.call(this, vargs)
            } else if (outcome) {
                return vargs[0]
            }
        })
    },
    reject: function (regex) {
        // Exclude all lines that match the regular expression.
        return gatherer(function filter (vargs) {
            var outcome = regex.apply(this, vargs)
            if (outcome instanceof RegExp) {
                regex = function ($) { return outcome.test($) }
                return filter.call(this, vargs)
            } else if (!outcome) {
                return vargs[0]
            }
        })
    }
}

// Return the symbol value if the token is a symbol. We know the token is a
// symbol if it is an array. The value is the first (and only) element of the
// array.
function symbol (token) {
    if (Array.isArray(token)) return token[0]
}

// Add JavaScript function parameters to a JavaScript the parameter list of a
// JavaScript command node.
function parameters (node, tokens) {
    while (tokens.length) {
        switch (symbol(tokens[0])) {
        case ')':
            tokens.shift()
            return
        case ',':
            tokens.shift()
            break
        default:
            node.parameters.push(tokens.shift())
        }
    }
}

function parse (args) {
    var node
    // TODO: Useless switch statement. What was the intent? To catch symbols in
    // the wrong order, I suppose. This function ought to always begin with a
    // string representing a command.
    //
    // TODO: We can probably just raise an exception when this resolves to a
    // symbol as opposed to a string.
    switch (symbol(args[0])) {
    default:
        // Create a new node in our parse tree.
        node = { command: args.shift(), parameters: [] }
        // Until we encounter a symbol, push arguments onto the parameters array of
        // the command.
        while (args.length && !symbol(args[0])) {
            node.parameters.push(args.shift())
        }
        // When we encounter a parenthesis, we're invoking a JavaScript command.
        if (symbol(args[0]) == '(') {
            node.javascript = true
            args.shift()
            parameters(node, args)
        // Otherwise, if we encounter redirections, we need to add a next command to
        // to our parse tree.
        } else {
            // Redirection in means we need to take note of an input file name.
            if (symbol(args[0]) == '<') {
                node.input = args.splice(0, 2).pop()
            }
            // Redirection out means we need to take note of an output file name.
            if (symbol(args[0]) == '>') {
                node.output = args.splice(0, 2).pop()
            // Otherwise, if we're piping, then we need to parse another command.
            } else if (symbol(args[0]) == '|') {
                args.shift()
                node.next = parse(args)
            }
        }
    }
    // Return the root node.
    return node
}

// Create a function using the given function body. The parameters passed to the
// function are positional, each named for a number, representing the one-based
// order in which the parameters were provided to the pipeline. They follow the
// shell convention of starting with a dollar sign. (i.e. `$1`, `$2`, etc.)
function funcify (string) {
    var f = [ '$' ]
    var position = 0
    var i
    string.replace(/\$(\d+)/, function (_, pos) { position = Math.max(position, pos) })
    for (i = 0; i < position; i++) {
        f.push('$' + (i + 1))
    }
    f.push('return ' + string)
    return Function.apply(Function, f)
}

// Execute a node.
function invoke (node, vargs) {
    // Resolve the name of the command.
    var command = node.command.apply(this, vargs)
    var parameters, pipe
    // If this is a JavaScript command, invoke the registered JavaScript command.
    if (node.javascript) {
        //die(node.parameters.toString())
        //parameters = node.parameters.map(function (parameter) {
        //  return parameter.apply(parameter, vargs)
        //})
        pipe = utilties[command].apply(this, node.parameters)
        pipe = pipe.call(this, vargs)
    // Otherwise this is an operating system command, spawn a child process.
    } else {
        parameters = node.parameters.map(function (parameter) {
            return parameter.apply(this, vargs)
        })
        pipe = children.spawn(command, parameters)
    }
    // If there is an input file, read it and pipe it to `STDIN`.
    if (node.input) {
        var input = fs.createReadStream(node.input.apply(this, vargs))
        input.pipe(pipe.stdin)
    }
    // If there is an output file, pipe `STDOUT` to it.
    if (node.output) {
        var output = fs.createWriteStream(node.output.apply(this, vargs))
        pipe.stdout.pipe(output)
    }
    // If there is a subsequent node, invoke the node and pipe the `STDOUT` of
    // this node to the `STDIN` of the next node.
    if (node.next) {
        var next = invoke(node.next, vargs)
        if (next.encoding) {
            pipe.stdout.setEncoding(next.encoding)
        }
        if (next.javascript) {
            pipe.on('exit', function (code) { next.emit('exit', code) })
        }
        pipe.stdout.pipe(next.stdin)
        pipe = next
    }
    // Return the (pseudo-)process.
    return pipe
}

// Wow, you know, if you can't figure out a stack trace, that's fine, you
// probably shouldn't be programming. I'm thinking about how in Java I'd always
// generate an exception at the point where it errored so people wouldn't get
// confused looking for it, but if you put the error generation in a function,
// it is easy to trace things through the stack.

// Standard error is one common pipe, unless a process invocation specifies a
// redirection.

// The first function, `conduit` has a lexer built into a while loop. After the
// lexer, the gathered tokens are given to a parser.
function conduit (command) {
    var args = []
    var rest = command
    var index = 0
    var string = []
    var tokens = []
    var call = 0
    var sub = 0
    // TODO: We're not actually going to have a stack for parenthesis, for
    // function calls in version 0.2.0. Thus, we need to note...

    // Only one level of function calls. There is no need to resolve nested
    // function calls in the Conduit languages. Those calls can be resolved
    // prior to invoking Conduit.

    // and tack needs to become a boolean `gather`.
    var stack = [ '' ]
    var $, redirection, part, join
    while (rest) {
        // Eat whitespace.
        $ = /^(\s*)(.*)$/.exec(rest), index += $[1].length, rest = $[2]
        // Match catenated strings stopping at any special character.
        // TODO: What is that `\\.` doing outside the string? Am I using `\\` as an
        // escape character in the command?
        $ = /^((?:[^,\\'"\s\/()$]|\\.|(["'])(?:[^\\\1]|\\.)*\2)*)(.*)/.exec(rest)
        if (!$) throw error(index)
        part = $[1], rest = $[3]
        // If we are not inside a string, then check to see if we have a
        // redirection character to push onto the token list.
        if (!string.length && (redirection = DIRECTION[part])) {
            tokens.push(redirection)
        //
        } else {
            // If we are gathering arguments for a function call, we push the part
            // onto the string, joining string directly with no delimiter.
            if (stack[0]) {
                join = ''
                string.push(part)
            // Otherwise, we're building a catenated string argument from the command
            // line. We go to some trouble to allow string catenation in the Conduit
            // language in command arguments, but we do not allow catenated strings to
            // function arguments. We accommodate command arguments to make syntax
            // such as `--parameter=$1` legible, but that sort of naming would not be
            // apparent arguments to JavaScript command functions.
            } else {
                join = ' + '
                part.replace(/([^"']*)(?:(?:(["'])(?:[^\\\1]|\\.)*\1|\\.)([^"']*))?/g, function ($, before, quoted, after) {
                    if (before) quote(before)
                    if (quoted) {
                        quoted = quoted[0] == '\\' ? quoted[1]
                                                                              : quoted.slice(1, quoted.length - 1).replace(/\\(.)/g, "$1")
                        quote(quoted)
                    }
                    if (after) quote(after)
                })
            }
            // Extract a possible argument variable reference.
            if ($ = /^(\$\d+)(.*)$/.exec(rest)) {
                string.push($[1]), rest = $[2]
            }
            // If we are gathering arguments parenthesis, we want to match any
            // parenthesis in the parenthesis. The regular expression above should
            // skip over any parens that are quoted in strings. TODO: Convince
            // yourself that they will also skip over parens in regular expressions.
            if (stack[0]) {
                if (stack[0] == rest[0]) {
                    if (rest[0] == ')') call--
                    if (call) {
                        if (rest[0] == '(') die("Can't actually get here.")
                        if (rest[0] == '(') call++
                        string.push(rest[0]), rest = rest.substring(1)
                    } else {
                        token(SYMBOL[rest[0]]), rest = rest.substring(1)
                    }
                } else {
                    if (rest[0] == '(') call++
                    string.push(rest[0]), rest = rest.substring(1)
                }
            // White space means we've completed a command argument.
            } else if (/^\s/.exec(rest)) {
                token()
            // A comma within function arguments is an argument delimiter, but it has
            // no special meaning within a string.
            } else if ($ = /^(,)(.*)$/.exec(rest)) {
                if (call) {
                    token(SYMBOL[$[1]]), rest = $[2]
                } else {
                    quote($[1]), rest = $[2]
                }
            // A meaningless dollar sign is added to the string.
            } else if ($ = /^(\$)(.*)$/.exec(rest)) {
                quote($[1]), rest = $[2]
            // Increment the parenthesis count for function arguments.
            } else if ($ = /^(\()(.*)$/.exec(rest)) {
                token(SYMBOL[$[1]]), rest = $[2]
                call++
            // Decrement the parenthesis count for function arguments.
            } else if ($ = /^(\))(.*)$/.exec(rest)) {
                token(SYMBOL[$[1]]), rest = $[2]
                call--
            // TODO: More logic for capturing inline functions and regular
            // expressions.
            } else if (call && ($ = /^(\/)(.*)$/.exec(rest))) {
                if (!string.length) {
                    string.push($[1])
                    stack.unshift(')')
                    rest = $[2]
                    join = ''
                }
            }
        }
    }

    if (string.length) token()
    tokens = tokens.map(function (token) { return Array.isArray(token) ? token : funcify(token) })

    var node = parse(tokens)
    return function () {
        var vargs = [ (void(0)) ].concat(slice(arguments)),
                proc = invoke(node, vargs),
                conduit = new Conduit()

        proc.on('exit', function () {
            conduit.emit.apply(conduit, [ 'exit' ].concat(arguments))
        })
        proc.on('close', function () {
            conduit.emit.apply(conduit, [ 'close' ].concat(arguments))
        })

        // TODO: Skip if redirected.
        conduit.stdout = proc.stdout

        return conduit
    }

    // Quote a string with JavaScript quotes and add to the current string.
    function quote (unquoted) {
        string.push(JSON.stringify(unquoted))
    }

    // Invoked when we've reached the end of a token. It pushes the accumulated
    // string as a token onto our list of tokens, then pushes it's arguments onto
    // the list of tokens.
    function token () {
        tokens.push(string.splice(0).join(join))
        tokens.push.apply(tokens, arguments)
    }

    // Wrapper for exception construction.
    function error (index) { return new Error("invalid syntax at: " + index) }
}

module.exports = conduit
