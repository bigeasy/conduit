module.exports = function (timeout, vargs) {
    return typeof vargs[0] == 'number' ? vargs.shift() : timeout
}
