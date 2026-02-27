import Sequencer from '@jest/test-sequencer';
import type { Test } from 'jest-runner';

/**
 * Custom test sequencer that runs test files in alphabetical order.
 * This ensures numeric-prefixed tests (01, 02, ...) run in sequence,
 * allowing later tests to depend on data created by earlier ones.
 */
class CustomSequencer extends Sequencer {
  sort(tests: Test[]): Test[] {
    return [...tests].sort((a, b) => a.path.localeCompare(b.path));
  }
}

export default CustomSequencer;
