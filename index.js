var slice = channel.call.bind([].slice)
  , fs = require('fs')
  , EventEmitter = require('events').EventEmitter
  , through = require('through')
  , spawn = require('child_process').spawn
  ;

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
  , exec: { get: function () {
      return spawn.apply(spawn, [ vargs.shift(), vargs ])
    } }
  , pipe: { get: function () {
      var codes = [], count = 0, events = new EventEmitter();
      events.stderr = through();
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
        events.stdout = vargs[vars.length - 1].stdout;
      }
      return events;
    } }
  });
}

// So.. We create an object, or a function with properties and we don't
// determine what the function is until a member is called.
function channel () {
  return new Channel(slice(arguments, 0));
}

module.exports = channel;
