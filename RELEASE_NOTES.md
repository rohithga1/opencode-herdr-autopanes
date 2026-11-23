# v0.2.1 — Reliable completed-viewer cleanup

**Experimental GitHub prerelease; not published to npm.**

v0.2.1 keeps the v0.2.0 grouped full-size viewer experience and fixes manual
completed-viewer cleanup.

## What changed

- Adds `/herdr-autopanes-close-completed` as a slash command and palette action.
- Reports the number of viewer tabs closed, skipped with reasons, and closure
  failures. It never claims success when no tab closed.
- Closes only finished viewers owned by the current parent group.
- Preserves running, blocked, explicitly pinned, currently focused, uncertain,
  and unrelated viewers. Native OpenCode conversations and sessions are never
  cancelled or deleted.
- Separates transient current-focus protection from explicit `ocap_pin=1`
  protection. Viewing a completed child and returning to its parent does not
  permanently exclude it from an explicit close action.
- Keeps automatic closing disabled by default and conservative when enabled.
- Improves the first-time README, adds a Herdr workspace guide, and includes a
  short real-recording script alongside the existing grouped-sidebar capture.
- Makes the setup journal and upgrade paths version-aware, including upgrades
  from v0.1.0 and v0.2.0.

The broader `/herdr-autopanes-cleanup` action remains separate. Its notification
is: **“Viewer tabs closed. Conversations preserved; any active work continues.”**

## Defaults and compatibility

Defaults remain background tabs, four viewers per orchestrator including
retained viewers, retention enabled, and automatic closing off. Split mode
remains available. Cross-tab grouping still requires the bundled Herdr Sidebar
0.3.0 companion snapshot at
`8a45adc5c0dd02f5cffeae5e900738035c9b3b82`; stock `hs_parent` is same-tab only.
Text labels require no font installation.

Tested versions remain Ubuntu 26.04.1 LTS, OpenCode 2.3.2, Herdr 0.9.5,
Node 26.13.1, npm 12.2.3 and Python 3.14.4 (runtime minimum Python 3.11+).
Two moderate dependency advisories remain; see DEPENDENCIES.md. Native nested
delegation, cold recovery and remote HTTPS Basic authentication remain
unverified. Herdr/OpenCode close-vs-click races are not atomic.

See README.md and `release-checks/0.2.1.md` for installation, upgrade,
verification and rollback details. v0.1.0 and v0.2.0 remain preserved.
