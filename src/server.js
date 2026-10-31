import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import si from 'systeminformation';
import { openDb, defaultDbPath, insertSnapshot, getSnapshots, getSnapshot, getLatestSnapshot, insertChanges, getTimeline } from './db.js';
import { scanSystem } from './scanner.js';
import { diffScans, groupChanges } from './diff.js';
import { explainChanges } from './explain.js';
import { renderReportHtml } from './report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const db = openDb(defaultDbPath());

function send(res, status, obj, contentType = 'application/json') {
  const body = contentType === 'application/json' ? JSON.stringify(obj) : obj;
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, platform: process.platform });
    if (url.pathname === '/api/scan' && req.method === 'POST') {
      const previous = getLatestSnapshot(db);
      const data = await scanSystem(si);
      const snapshot = insertSnapshot(db, data);
      const changes = previous ? diffScans(previous.data, data) : [];
      if (changes.length) insertChanges(db, snapshot.id, changes, snapshot.created_at);
      return send(res, 200, { snapshot: { id: snapshot.id, created_at: snapshot.created_at }, changes, explanation: explainChanges(changes) });
    }
    if (url.pathname === '/api/snapshots') return send(res, 200, getSnapshots(db));
    if (url.pathname === '/api/timeline') {
      return send(res, 200, getTimeline(db, { type: url.searchParams.get('type') || undefined, from: url.searchParams.get('from') || undefined, to: url.searchParams.get('to') || undefined }));
    }
    if (url.pathname === '/api/compare') {
      const from = getSnapshot(db, Number(url.searchParams.get('from')));
      const to = getSnapshot(db, Number(url.searchParams.get('to')));
      if (!from || !to) return send(res, 404, { error: 'snapshot not found' });
      const changes = diffScans(from.data, to.data);
      return send(res, 200, { from: { id: from.id, created_at: from.created_at }, to: { id: to.id, created_at: to.created_at }, changes, grouped: groupChanges(changes), explanation: explainChanges(changes) });
    }
    if (url.pathname === '/api/export') {
      return send(res, 200, { snapshots: getSnapshots(db), timeline: getTimeline(db) });
    }
    if (url.pathname.startsWith('/api/report/')) {
      const id = Number(url.pathname.split('/').pop());
      const snapshot = getSnapshot(db, id);
      if (!snapshot) return send(res, 404, { error: 'snapshot not found' });
      const changes = getTimeline(db).filter(c => c.snapshot_id === id);
      if (url.searchParams.get('format') === 'json') return send(res, 200, { snapshot, changes, explanation: explainChanges(changes) });
      return send(res, 200, renderReportHtml({ snapshot, changes }), 'text/html');
    }
    // Static UI
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.join(__dirname, '..', 'public', file);
    if (!filePath.startsWith(path.join(__dirname, '..', 'public')) || !fs.existsSync(filePath)) {
      return send(res, 404, { error: 'not found' });
    }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
    return send(res, 200, fs.readFileSync(filePath, 'utf8'), types[ext] || 'text/plain');
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: String(err.message || err) });
  }
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(`ChangeTrace running at http://localhost:${PORT}`));
}
export default server;
