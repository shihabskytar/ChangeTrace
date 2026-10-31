import test from 'node:test';
import assert from 'node:assert/strict';
import { diffScans, groupChanges } from '../src/diff.js';

const oldData = { apps: [{ name: 'vim', version: '1' }, { name: 'oldapp', version: '1' }], startup: [{ name: 'a.desktop', path: '/x' }], services: [], tasks: [], drivers: [], network: { interfaces: [{ name: 'eth0', ip4: '10.0.0.1' }] }, settings: { hostname: 'pc1' } };
const newData = { apps: [{ name: 'vim', version: '2' }, { name: 'newapp', version: '1' }], startup: [{ name: 'a.desktop', path: '/x' }, { name: 'b.desktop', path: '/y' }], services: [], tasks: [], drivers: [], network: { interfaces: [{ name: 'eth0', ip4: '10.0.0.2' }] }, settings: { hostname: 'pc1' } };

test('diff detects added, removed, changed', () => {
  const changes = diffScans(oldData, newData);
  assert.ok(changes.some(c => c.type === 'app' && c.action === 'added' && c.name === 'newapp'));
  assert.ok(changes.some(c => c.type === 'app' && c.action === 'removed' && c.name === 'oldapp'));
  assert.ok(changes.some(c => c.type === 'app' && c.action === 'changed' && c.name === 'vim'));
  assert.ok(changes.some(c => c.type === 'startup' && c.action === 'added' && c.name === 'b.desktop'));
  assert.ok(changes.some(c => c.type === 'network' && c.action === 'changed'));
  const grouped = groupChanges(changes);
  assert.equal(grouped.app.added.length, 1);
});
