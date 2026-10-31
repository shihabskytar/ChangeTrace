// Plain-language explanations for a set of changes. No ML, no telemetry.
// Accepts both diff objects ({type, name}) and DB timeline rows ({change_type, item_name}).
export function explainChanges(rawChanges) {
  const changes = (rawChanges || []).map(c => ({ type: c.type || c.change_type, action: c.action, name: c.name || c.item_name, key: c.key || c.item_key }));
  const by = (type, action) => changes.filter(c => c.type === type && c.action === action);
  const sentences = [];
  const newStartup = by('startup', 'added');
  if (newStartup.length > 0) {
    const names = newStartup.slice(0, 3).map(c => c.name).join(', ');
    const more = newStartup.length > 3 ? ` and ${newStartup.length - 3} more` : '';
    sentences.push(`Your startup time may have increased after ${newStartup.length} application${newStartup.length === 1 ? '' : 's'} ${newStartup.length === 1 ? 'was' : 'were'} added to startup: ${names}${more}.`);
  }
  const removedStartup = by('startup', 'removed');
  if (removedStartup.length > 0) sentences.push(`${removedStartup.length} startup entr${removedStartup.length === 1 ? 'y was' : 'ies were'} removed, which may make startup faster.`);
  const newServices = by('service', 'added');
  if (newServices.length > 0) sentences.push(`${newServices.length} new service${newServices.length === 1 ? ' was' : 's were'} added, which can affect background activity and resource use.`);
  const newTasks = by('task', 'added');
  if (newTasks.length > 0) sentences.push(`${newTasks.length} new scheduled task${newTasks.length === 1 ? ' was' : 's were'} added, which can run things in the background at set times.`);
  const newApps = by('app', 'added');
  if (newApps.length > 0) sentences.push(`${newApps.length} application${newApps.length === 1 ? ' was' : 's were'} installed: ${newApps.slice(0, 3).map(c => c.name).join(', ')}${newApps.length > 3 ? ` and ${newApps.length - 3} more` : ''}.`);
  const removedApps = by('app', 'removed');
  if (removedApps.length > 0) sentences.push(`${removedApps.length} application${removedApps.length === 1 ? ' was' : 's were'} removed.`);
  const changedDrivers = by('driver', 'changed');
  const newDrivers = by('driver', 'added');
  if (changedDrivers.length > 0 || newDrivers.length > 0) sentences.push(`Driver changes were detected (${changedDrivers.length} changed, ${newDrivers.length} added) — if sound, display, or Wi-Fi changed recently, check these first.`);
  const net = changes.filter(c => c.type === 'network');
  if (net.length > 0) sentences.push(`Network configuration changed (${net.length} item${net.length === 1 ? '' : 's'}), which can explain connectivity changes.`);
  const settings = by('setting', 'changed');
  if (settings.length > 0) sentences.push(`System settings changed: ${settings.map(c => c.name).join(', ')}.`);
  if (sentences.length === 0) sentences.push('No changes detected between these dates.');
  return sentences;
}
