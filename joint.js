function Joint (one, two) {
    one.read.shifter().pump(two, 'push')
    two.read.shifter().pump(one, 'push')
}
