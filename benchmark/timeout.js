var Benchmark = require('benchmark')

var suite = new Benchmark.Suite('minimal')

var timeout = setTimeout(function () { }, 5000)

function fn () {
    clearTimeout(timeout)
    setTimeout(function () {}, 5000)
}

var last = null

function fn_ () {
    last = Date.now()
}

fn()
fn_()

for (var i = 1; i <= 4; i++) {
    suite.add({
        name: 'timeout ' + i,
        fn: fn
    })

    suite.add({
        name: 'nothing ' + i,
        fn: fn_
    })
}

suite.on('cycle', function(event) {
    console.log(String(event.target));
})

suite.on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
})

suite.run()
