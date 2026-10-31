async function api(path, opts) { const r = await fetch(path, opts); return r.json(); }
function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); document.getElementById('tab-'+b.dataset.tab).classList.add('active');
});
async function loadTimeline(){
  const type=document.getElementById('typeFilter').value;
  const from=document.getElementById('fromDate').value; const to=document.getElementById('toDate').value;
  const q=new URLSearchParams(); if(type)q.set('type',type); if(from)q.set('from',from); if(to)q.set('to',to);
  const items=await api('/api/timeline?'+q);
  document.getElementById('timeline').innerHTML=items.map(i=>`<li class="${esc(i.action)}"><b>${esc(i.action)}</b> ${esc(i.change_type)}: ${esc(i.item_name)} <small>${esc(i.created_at)}</small><br><small>${esc(i.details||'')}</small></li>`).join('')||'<li>No changes recorded yet. Run a scan.</li>';
}
async function loadSnapshots(){
  const snaps=await api('/api/snapshots');
  document.getElementById('snapshots').innerHTML=snaps.map(s=>`<li>Snapshot #${s.id} — ${esc(s.created_at)}</li>`).join('')||'<li>No snapshots yet.</li>';
  for(const sel of ['fromSnap','toSnap','reportSnap']){const el=document.getElementById(sel); el.innerHTML=snaps.map(s=>`<option value="${s.id}">#${s.id} — ${esc(s.created_at)}</option>`).join('');}
}
document.getElementById('scanBtn').onclick=async()=>{
  document.getElementById('scanStatus').textContent='Scanning…';
  const r=await api('/api/scan',{method:'POST'});
  document.getElementById('scanStatus').textContent=`Done — snapshot #${r.snapshot.id}, ${r.changes.length} change(s).`;
  loadTimeline(); loadSnapshots();
};
document.getElementById('refreshTimeline').onclick=loadTimeline;
document.getElementById('compareBtn').onclick=async()=>{
  const from=document.getElementById('fromSnap').value, to=document.getElementById('toSnap').value;
  const r=await api(`/api/compare?from=${from}&to=${to}`);
  document.getElementById('explanation').innerHTML='<h3>In plain language</h3><ul>'+r.explanation.map(s=>`<li>${esc(s)}</li>`).join('')+'</ul>';
  document.getElementById('compareResult').innerHTML=Object.entries(r.grouped).map(([type,g])=>`<div class="card"><h3>${esc(type)}</h3><p>Added ${g.added.length} · Removed ${g.removed.length} · Changed ${g.changed.length}</p><ul>${[...g.added,...g.removed,...g.changed].map(c=>`<li class="${esc(c.action)}">${esc(c.action)}: ${esc(c.name)}</li>`).join('')}</ul></div>`).join('');
};
document.getElementById('openReport').onclick=()=>{window.open('/api/report/'+document.getElementById('reportSnap').value,'_blank');};
document.getElementById('exportJson').onclick=()=>{window.open('/api/export','_blank');};
loadTimeline(); loadSnapshots();
