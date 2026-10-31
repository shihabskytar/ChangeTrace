// Compare two scan data objects. Categories are keyed by a stable name.
const CATEGORIES = [
  { key: 'apps', type: 'app', nameField: 'name', compare: (a, b) => a.version !== b.version },
  { key: 'startup', type: 'startup', nameField: 'name', compare: (a, b) => a.path !== b.path },
  { key: 'services', type: 'service', nameField: 'name', compare: (a, b) => a.status !== b.status },
  { key: 'tasks', type: 'task', nameField: 'name', compare: (a, b) => a.status !== b.status },
  { key: 'drivers', type: 'driver', nameField: 'name', compare: (a, b) => a.version !== b.version },
];

function toMap(list, nameField) {
  const m = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    if (item && item[nameField] && item[nameField] !== 'unknown') m.set(item[nameField], item);
  }
  return m;
}

export function diffScans(oldData, newData) {
  const changes = [];
  for (const cat of CATEGORIES) {
    const oldMap = toMap(oldData?.[cat.key], cat.nameField);
    const newMap = toMap(newData?.[cat.key], cat.nameField);
    for (const [key, item] of newMap) {
      if (!oldMap.has(key)) changes.push({ type: cat.type, action: 'added', key, name: item[cat.nameField], details: JSON.stringify(item) });
      else if (cat.compare(oldMap.get(key), item)) changes.push({ type: cat.type, action: 'changed', key, name: item[cat.nameField], details: `from ${JSON.stringify(oldMap.get(key))} to ${JSON.stringify(item)}` });
    }
    for (const [key, item] of oldMap) {
      if (!newMap.has(key)) changes.push({ type: cat.type, action: 'removed', key, name: item[cat.nameField], details: JSON.stringify(item) });
    }
  }
  // Network interfaces by name.
  const oldNet = toMap(oldData?.network?.interfaces, 'name');
  const newNet = toMap(newData?.network?.interfaces, 'name');
  for (const [key, item] of newNet) {
    if (!oldNet.has(key)) changes.push({ type: 'network', action: 'added', key, name: key, details: JSON.stringify(item) });
    else if (oldNet.get(key).ip4 !== item.ip4) changes.push({ type: 'network', action: 'changed', key, name: key, details: `IP ${oldNet.get(key).ip4} -> ${item.ip4}` });
  }
  for (const [key, item] of oldNet) {
    if (!newNet.has(key)) changes.push({ type: 'network', action: 'removed', key, name: key, details: JSON.stringify(item) });
  }
  // Selected settings by key.
  const oldS = oldData?.settings || {};
  const newS = newData?.settings || {};
  for (const key of new Set([...Object.keys(oldS), ...Object.keys(newS)])) {
    if (oldS[key] !== newS[key]) {
      changes.push({ type: 'setting', action: oldS[key] === undefined ? 'added' : 'changed', key, name: key, details: `${oldS[key] ?? 'unknown'} -> ${newS[key] ?? 'unknown'}` });
    }
  }
  return changes;
}

export function groupChanges(changes) {
  const grouped = {};
  for (const c of changes) {
    grouped[c.type] = grouped[c.type] || { added: [], removed: [], changed: [] };
    grouped[c.type][c.action]?.push(c);
  }
  return grouped;
}
