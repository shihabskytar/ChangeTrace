import test from 'node:test';
import assert from 'node:assert/strict';
import si from 'systeminformation';
import { scanSystem } from '../src/scanner.js';

test('live scan returns all categories without crashing', async () => {
  const data = await scanSystem(si);
  for (const key of ['apps', 'startup', 'services', 'tasks', 'drivers']) assert.ok(Array.isArray(data[key]), key);
  assert.ok(data.network && Array.isArray(data.network.interfaces));
  assert.ok(data.settings && data.settings.hostname);
});
