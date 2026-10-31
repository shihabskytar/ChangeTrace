import test from 'node:test';
import assert from 'node:assert/strict';
import { explainChanges } from '../src/explain.js';

test('startup explainer mentions increased startup time', () => {
  const s = explainChanges([
    { type: 'startup', action: 'added', name: 'a' },
    { type: 'startup', action: 'added', name: 'b' },
    { type: 'startup', action: 'added', name: 'c' },
  ]);
  assert.ok(s.join(' ').includes('startup time may have increased after 3 applications were added to startup'));
});
test('no changes gives a calm sentence', () => {
  assert.deepEqual(explainChanges([]), ['No changes detected between these dates.']);
});
