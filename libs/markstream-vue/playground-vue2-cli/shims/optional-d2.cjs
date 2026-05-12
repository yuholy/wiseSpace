function OptionalD2Unavailable() {
  throw new Error('Optional dependency "@terrastruct/d2" is not available in playground-vue2-cli.')
}

module.exports = OptionalD2Unavailable
module.exports.D2 = OptionalD2Unavailable
