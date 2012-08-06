# Channel [![Build Status](https://secure.travis-ci.org/bigeasy/channel.png?branch=master)](http://travis-ci.org/bigeasy/channel)

Pipeline constructor for Node.js.

# Synopsis

```javascript
var channel = require('../..')
  , fs = require('fs')
  , equal = require('assert').equal
  , meow, child;

// Channels are compiled into a function.
meow = channel('cat < $1 > out.txt');

// The function creates an event emitter.
child = meow(__filename);

// The event emitter tracks the progress of the channel.
child.on('exit', function () {
  equal(fs.readFileSync('out.txt', 'utf8'), fs.readFileSync(__filename, 'utf8'), 'copied');
  fs.unlinkSync('out.txt');
});
```

## Change Log

Changes for each release.

### Vervion 0.0.1

 * Update `README.md` for command interpreter. #12.
 * Implement as command interpreter. #13.

### Version 0.0.0

 * Build on Travis CI. #4.
 * Create pipeline. #2.
