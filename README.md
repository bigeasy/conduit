# Channel [![Build Status](https://secure.travis-ci.org/bigeasy/channel.png?branch=master)](http://travis-ci.org/bigeasy/channel)

Pipeline constructor for Node.js.

# Synopsis

```javascript
var $ = require('channel'), pipe;

pipe = $(__filename).read, $('tee').exec, $('out.txt').write).pipe

pipe.on('exit', function () {
  var fs = require('fs')
    , equal = require('assert').equal;

  equal(fs.readFileSync('out.txt', 'utf8'), fs.readFileSync(__filename, 'utf8'), 'copied');
});
```

## Change Log

Changes for each release.

### Version 0.0.0

Released: Mon Jul 23 10:54:45 UTC 2012

 * Build on Travis CI. #4.
 * Create pipeline. #2.
