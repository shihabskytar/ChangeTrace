# ChangeTrace — Discover exactly what changed on your PC

A computer suddenly becomes slow, starts showing ads, loses sound, or behaves
differently. The user asks: **What changed?**

Windows doesn't give ordinary users a convenient chronological explanation.
ChangeTrace is a **local system-change diary**. It records important changes
over time and explains them in plain language — no cloud, no telemetry.

## The differentiating feature

Not just a list of events, but a sequence explained in plain language:

> "Your startup time may have increased after three applications were added to startup."

The explainer in `src/explain.js` turns a comparison into sentences about
startup entries, services, scheduled tasks, installed/removed apps, driver
changes, network changes, and settings changes.

## MVP checklist

- [x] 1. Track installed applications — live scan + persisted list, install/remove detection between scans
- [x] 2. Monitor startup entries — live scan + persisted list
- [x] 3. Record selected configuration changes — services, scheduled tasks / cron, network config summary, selected OS settings, drivers (best-effort per OS, `unknown` when data is unavailable, never crashes)
- [x] 4. Timeline interface — chronological list, filterable by type and date
- [x] 5. Before/after comparison — pick two snapshots, see added / removed / changed grouped by type, plus a plain-language explanation
- [x] 6. Export diagnostic reports — HTML report page (print → Save as PDF) + JSON export endpoint

## How to run

```bash
npm install
npm start
# open http://localhost:3000
# Click "Scan now", scan again later, then use Timeline and Compare.
```

Tests:

```bash
npm test
```

Data lives in `changetrace.db` next to the app (override with
`CHANGETRACE_DB=/path/to/file.db`). The DB is gitignored — the repo ships clean.

## Architecture

```
src/server.js    HTTP API + static UI server (no framework)
src/scanner.js   Per-OS live scans (systeminformation + OS-native commands)
src/db.js        SQLite via Node's built-in node:sqlite
src/diff.js      Snapshot-to-snapshot added/removed/changed detection
src/explain.js   Plain-language explanations
src/report.js    HTML diagnostic report
public/          Responsive web UI (grid/flex, mobile + desktop)
```

Windows support: registry / startup / services / scheduled tasks are read via
PowerShell where present. Linux: dpkg / flatpak / snap, systemd services,
cron, autostart files. macOS: `/Applications`, LaunchAgents, `launchctl`,
brew services where present. Anything missing is reported as `unknown`,
never as invented data.

## Privacy

All data stays local in `changetrace.db`. ChangeTrace makes no network
requests to any cloud service. The only network use is serving the UI on
localhost.

## Why not the competitors?

HWINFO / Speccy / CPU-Z / CrystalDiskInfo show a snapshot, not a history.
Event Viewer, Sysmon, and Autoruns expose individual activity types in
expert formats, not one simple consumer timeline. Windows Reliability
Monitor shows crashes and installs, not startup, services, tasks, network,
and settings changes together. ChangeTrace's gap is the **one chronological,
human-readable diary** across all of those.

## Deliberately out of this MVP

- Windows-only deep hooks: ETW / Sysmon integration, real-time background watcher service (scans are on-demand; a scheduled scan can be added with Task Scheduler / cron / launchd running `curl -X POST http://localhost:3000/api/scan`)
- Driver version history on Linux beyond kernel modules (reported as `unknown` version where the OS does not expose it)
- Multi-user / remote machines — this is a single-machine, local diary
