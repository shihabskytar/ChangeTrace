import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
const UNKNOWN = 'unknown';

async function run(cmd, args = [], timeout = 8000) {
  try {
    const { stdout } = await exec(cmd, args, { timeout, maxBuffer: 4 * 1024 * 1024 });
    return stdout.trim();
  } catch {
    return '';
  }
}

async function listDir(dir) {
  try { return await fs.readdir(dir); } catch { return []; }
}

async function scanApps() {
  // Linux: dpkg / flatpak / snap. Windows/macOS: best-effort, never crash.
  if (process.platform === 'win32') {
    const out = await run('powershell', ['-NoProfile', '-Command',
      'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName,DisplayVersion | ConvertTo-Json -Compress']);
    try {
      const parsed = JSON.parse(out);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.filter(a => a.DisplayName).map(a => ({ name: a.DisplayName, version: a.DisplayVersion || UNKNOWN }));
    } catch { return [{ name: UNKNOWN, version: UNKNOWN }]; }
  }
  if (process.platform === 'darwin') {
    const out = await run('ls', ['/Applications']);
    return out.split('\n').filter(Boolean).map(name => ({ name, version: UNKNOWN }));
  }
  const apps = new Map();
  const dpkg = await run('dpkg-query', ['-W', '-f=${Package}\t${Version}\n']);
  for (const line of dpkg.split('\n')) {
    const [name, version] = line.split('\t');
    if (name) apps.set(name, { name, version: version || UNKNOWN });
  }
  const flatpak = await run('flatpak', ['list', '--app', '--columns=application,version']);
  for (const line of flatpak.split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts[0]) apps.set(parts[0], { name: parts[0], version: parts[parts.length - 1] || UNKNOWN });
  }
  const snap = await run('snap', ['list']);
  for (const line of snap.split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts[0]) apps.set(parts[0], { name: parts[0], version: parts[1] || UNKNOWN });
  }
  return [...apps.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function scanStartup() {
  if (process.platform === 'win32') {
    const out = await run('powershell', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_StartupCommand | Select-Object Name,Command | ConvertTo-Json -Compress']);
    try {
      const parsed = JSON.parse(out);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.filter(s => s.Name).map(s => ({ name: s.Name, path: s.Command || UNKNOWN }));
    } catch { return [{ name: UNKNOWN, path: UNKNOWN }]; }
  }
  const entries = new Map();
  const dirs = [
    path.join(os.homedir(), '.config', 'autostart'),
    '/etc/xdg/autostart',
    ...(process.platform === 'darwin' ? [path.join(os.homedir(), 'Library', 'LaunchAgents')] : []),
  ];
  for (const dir of dirs) {
    for (const file of await listDir(dir)) {
      if (file.endsWith('.desktop') || file.endsWith('.plist')) entries.set(file, { name: file, path: path.join(dir, file) });
    }
  }
  const crontab = await run('crontab', ['-l']);
  for (const line of crontab.split('\n')) {
    if (line.includes('@reboot')) entries.set(line, { name: line.trim(), path: 'crontab @reboot' });
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function scanServices() {
  if (process.platform === 'win32') {
    const out = await run('powershell', ['-NoProfile', '-Command',
      'Get-Service | Select-Object Name,Status | ConvertTo-Json -Compress']);
    try {
      const parsed = JSON.parse(out);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.filter(s => s.Name).map(s => ({ name: s.Name, status: s.Status || UNKNOWN }));
    } catch { return [{ name: UNKNOWN, status: UNKNOWN }]; }
  }
  if (process.platform === 'darwin') {
    const out = await run('launchctl', ['list']);
    return out.split('\n').slice(1).filter(Boolean).map(line => {
      const parts = line.trim().split(/\s+/);
      return { name: parts[2] || line, status: parts[0] || UNKNOWN };
    });
  }
  const out = await run('systemctl', ['list-unit-files', '--type=service', '--no-pager', '--no-legend']);
  if (!out) return [{ name: UNKNOWN, status: UNKNOWN }];
  return out.split('\n').filter(Boolean).map(line => {
    const parts = line.trim().split(/\s+/);
    return { name: parts[0], status: parts[1] || UNKNOWN };
  }).filter(s => s.name);
}

async function scanTasks() {
  if (process.platform === 'win32') {
    const out = await run('powershell', ['-NoProfile', '-Command',
      'Get-ScheduledTask | Select-Object TaskName,State | ConvertTo-Json -Compress']);
    try {
      const parsed = JSON.parse(out);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.filter(t => t.TaskName).map(t => ({ name: t.TaskName, status: t.State || UNKNOWN }));
    } catch { return [{ name: UNKNOWN, status: UNKNOWN }]; }
  }
  const tasks = new Map();
  const crontab = await run('crontab', ['-l']);
  for (const line of crontab.split('\n').filter(l => l && !l.startsWith('#'))) {
    tasks.set(line, { name: line, status: 'cron' });
  }
  for (const dir of ['/etc/cron.d', '/etc/cron.daily', '/etc/cron.hourly']) {
    for (const f of await listDir(dir)) tasks.set(`${dir}/${f}`, { name: `${dir}/${f}`, status: 'cron' });
  }
  if (process.platform === 'darwin') {
    const brew = await run('brew', ['services', 'list']);
    for (const line of brew.split('\n').slice(1).filter(Boolean)) tasks.set(line, { name: line, status: 'brew service' });
  }
  return [...tasks.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function scanNetwork(si) {
  try {
    const interfaces = await si.networkInterfaces();
    const gateway = await si.networkGatewayDefault().catch(() => UNKNOWN);
    return {
      interfaces: (Array.isArray(interfaces) ? interfaces : [interfaces]).map(i => ({
        name: i.ifaceName || i.iface || UNKNOWN,
        ip4: i.ip4 || UNKNOWN,
        mac: i.mac || UNKNOWN,
      })),
      gateway: typeof gateway === 'string' ? gateway : UNKNOWN,
    };
  } catch {
    return { interfaces: [{ name: UNKNOWN, ip4: UNKNOWN, mac: UNKNOWN }], gateway: UNKNOWN };
  }
}

async function scanDrivers() {
  if (process.platform === 'win32') {
    const out = await run('powershell', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_PnPSignedDriver | Select-Object DeviceName,DriverVersion | ConvertTo-Json -Compress']);
    try {
      const parsed = JSON.parse(out);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.filter(d => d.DeviceName).map(d => ({ name: d.DeviceName, version: d.DriverVersion || UNKNOWN }));
    } catch { return [{ name: UNKNOWN, version: UNKNOWN }]; }
  }
  const out = await run('lsmod', []);
  if (!out) return [{ name: UNKNOWN, version: UNKNOWN }];
  return out.split('\n').slice(1).filter(Boolean).map(line => {
    const parts = line.trim().split(/\s+/);
    return { name: parts[0], version: UNKNOWN };
  });
}

export async function scanSystem(si) {
  let osInfo = { distro: UNKNOWN, platform: process.platform, arch: os.arch(), hostname: os.hostname() };
  try {
    const o = await si.osInfo();
    osInfo = { distro: o.distro || o.platform || UNKNOWN, platform: process.platform, arch: os.arch(), hostname: os.hostname(), release: o.release || UNKNOWN };
  } catch { /* keep unknown-safe defaults */ }
  const [apps, startup, services, tasks, network, drivers] = await Promise.all([
    scanApps(), scanStartup(), scanServices(), scanTasks(), scanNetwork(si), scanDrivers(),
  ]);
  return {
    os: osInfo,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || UNKNOWN,
    apps, startup, services, tasks, network, drivers,
    settings: {
      hostname: os.hostname(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || UNKNOWN,
      platform: process.platform,
      arch: os.arch(),
    },
  };
}
