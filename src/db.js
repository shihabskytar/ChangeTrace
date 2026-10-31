import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      action TEXT NOT NULL,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export function defaultDbPath() {
  return process.env.CHANGETRACE_DB || path.join(process.cwd(), 'changetrace.db');
}

export function insertSnapshot(db, data) {
  const createdAt = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO snapshots (created_at, data) VALUES (?, ?)');
  const info = stmt.run(createdAt, JSON.stringify(data));
  return { id: Number(info.lastInsertRowid), created_at: createdAt, data };
}

export function getSnapshots(db) {
  return db.prepare('SELECT id, created_at FROM snapshots ORDER BY id DESC').all();
}

export function getSnapshot(db, id) {
  const row = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id);
  if (!row) return null;
  return { id: row.id, created_at: row.created_at, data: JSON.parse(row.data) };
}

export function getLatestSnapshot(db) {
  const row = db.prepare('SELECT * FROM snapshots ORDER BY id DESC LIMIT 1').get();
  if (!row) return null;
  return { id: row.id, created_at: row.created_at, data: JSON.parse(row.data) };
}

export function insertChanges(db, snapshotId, changes, createdAt) {
  const stmt = db.prepare(
    'INSERT INTO changes (snapshot_id, change_type, action, item_key, item_name, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const c of changes) {
    stmt.run(snapshotId, c.type, c.action, c.key, c.name, c.details || '', createdAt);
  }
}

export function getTimeline(db, { type, from, to } = {}) {
  let sql = 'SELECT * FROM changes WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND change_type = ?'; params.push(type); }
  if (from) { sql += ' AND created_at >= ?'; params.push(from); }
  if (to) { sql += ' AND created_at <= ?'; params.push(to); }
  sql += ' ORDER BY created_at DESC, id DESC';
  return db.prepare(sql).all(...params);
}

export function deleteSnapshotAndChanges(db, id) {
  db.prepare('DELETE FROM changes WHERE snapshot_id = ?').run(id);
  db.prepare('DELETE FROM snapshots WHERE id = ?').run(id);
}
