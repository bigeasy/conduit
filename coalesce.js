module.exports = function () {
    var vargs = Array.prototype.slice.call(arguments)
    for (var i = 0, I = vargs.length; i < I; i++) {
        if (vargs[i] != null) {
            return vargs[i]
        }
    }
    return null
}
