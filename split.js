var buffer = new Buffer('👻')

console.log(buffer.length)
console.log(buffer.toString())
console.log(buffer.slice(0, 2).toString())
console.log(new Buffer(buffer.slice(0, 2).toString()).length)
