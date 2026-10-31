import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, insertSnapshot, getLatestSnapshot, insertChanges, getTimeline } from '../src/db.js';

test('snapshots and timeline round-trip', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ct-')), 'test.db');
  const db = openDb(file);
  const snap = insertSnapshot(db, { apps: [] });
  insertChanges(db, snap.id, [{ type: 'app', action: 'added', key: 'x', name: 'x', details: '' }], snap.created_at);
  assert.equal(getLatestSnapshot(db).id, snap.id);
  assert.equal(getTimeline(db).length, 1);
  db.close();
});
