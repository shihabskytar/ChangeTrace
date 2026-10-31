import { explainChanges } from './explain.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderReportHtml({ snapshot, changes, fromSnapshot }) {
  const data = snapshot.data;
  const explanations = explainChanges(changes);
  const rows = changes.map(c => `<tr><td>${esc(c.change_type)}</td><td>${esc(c.action)}</td><td>${esc(c.item_name)}</td><td>${esc(c.details || '')}</td></tr>`).join('') || '<tr><td colspan="4">No changes recorded.</td></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>ChangeTrace diagnostic report</title>
<style>
body{font-family:system-ui,Arial,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#111}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:.4rem;text-align:left}
@media print{body{margin:0}}
</style></head><body>
<h1>ChangeTrace diagnostic report</h1>
<p>Snapshot #${snapshot.id} — ${esc(snapshot.created_at)}${fromSnapshot ? ` (compared with snapshot #${fromSnapshot.id}, ${esc(fromSnapshot.created_at)})` : ''}</p>
<p>Device: ${esc(data.os?.hostname || 'unknown')} · ${esc(data.os?.distro || 'unknown')} · ${esc(data.settings?.platform || 'unknown')} ${esc(data.settings?.arch || '')}</p>
<h2>What changed, in plain language</h2><ul>${explanations.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
<h2>Changes (${changes.length})</h2><table><tr><th>Type</th><th>Action</th><th>Item</th><th>Details</th></tr>${rows}</table>
<h2>Inventory at this snapshot</h2>
<p>Apps: ${data.apps?.length ?? 0} · Startup entries: ${data.startup?.length ?? 0} · Services: ${data.services?.length ?? 0} · Scheduled tasks: ${data.tasks?.length ?? 0} · Drivers: ${data.drivers?.length ?? 0}</p>
<p><em>Generated locally by ChangeTrace. No data was sent anywhere.</em></p>
</body></html>`;
}
