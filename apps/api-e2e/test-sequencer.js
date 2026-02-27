const Sequencer = require('@jest/test-sequencer').default;

/**
 * Custom test sequencer that runs test files in alphabetical order.
 * This ensures numeric-prefixed tests (01, 02, ...) run in sequence,
 * allowing later tests to depend on data created by earlier ones.
 */
class AlphabeticalSequencer extends Sequencer {
  sort(tests) {
    return [...tests].sort((a, b) => a.path.localeCompare(b.path));
  }
}

module.exports = AlphabeticalSequencer;
