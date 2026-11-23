# v0.2.0 — Grouped subagent views without terminal splits

**Experimental GitHub prerelease; not published to npm.**

Watch native OpenCode subagents from a grouped Herdr sidebar. Each child has a
readable name/status and a full-size background tab in the existing workspace.
Click its row to inspect, then the parent to return. Launches leave the main
tab's layout and focus intact. Completed views remain accessible by default.

Defaults: tabs, four viewers per owning orchestrator (retained results count),
automatic closing off. Split mode remains optional. Overflow skips viewers,
not native execution. Cleanup is scoped to its owning terminal.

## One package, both components

The `.tgz` bundles Autopanes 0.2.0 and Herdr Sidebar 0.3.0 at upstream commit
`8a45adc5c0dd02f5cffeae5e900738035c9b3b82`, with cross-tab extension 0.2.0.
Upstream `hs_parent` alone cannot group across tabs. Exact sources, licenses,
notices and local-change attribution are included. Text mode requires no font.
Python 3.11+ is required alongside Node/npm, OpenCode 2.3.2 and Herdr 0.9.5.

Download the tarball and SHA256SUMS; verify them, install with npm into a stable
versioned prefix, then run the packaged `scripts/setup.py install` and `doctor`
inside the target Herdr terminal. Full copy-paste commands are in README.md.
No service restart is needed. No unpinned companion branch is fetched.

## Upgrade and rollback

Keep the v0.1.0 directory. Install 0.2.0 in a separate prefix, then:

```sh
NEW="$HOME/.local/share/opencode-herdr-autopanes/0.2.0/node_modules/opencode-herdr-autopanes"
python3 "$NEW/scripts/setup.py" install --upgrade-from "/absolute/path/to/old/package" --dry-run
python3 "$NEW/scripts/setup.py" install --upgrade-from "/absolute/path/to/old/package"
python3 "$NEW/scripts/setup.py" doctor
```

This replaces the old registration and selects the new defaults. Existing
viewers are not moved or closed. `setup.py rollback` restores the recorded old
registration; `uninstall` removes owned registrations without restoring it.
Unrelated settings, later edits and private backups are preserved. Edits to
managed sidebar tables stop removal until reconciled.

Existing stock/customized companions are not overwritten: remove their managed
configuration with their own installer, retain the checkout/backups, then unlink
their registration before installing this bundle. Byte-verified compatible
companions can be reused and remain user-owned.

## Safety and limitations

- Auto-close is opt-in; selecting a viewer permanently pins it. Active native
  work, background shells, pending forms/permissions and unknown/failed states
  retain it. No atomic cross-process close/inspection guarantee exists.
- Visual grouping is not collapsible. Viewers are real resource-consuming TUIs.
- Native nested delegation, cold recovery and explicit remote HTTPS Basic auth
  remain unverified live. Auth permits HTTPS or loopback HTTP origins only.
- Same-user metadata is bookkeeping, not authentication. One sidebar override
  reporter should be active. Cleanup may briefly shift Herdr focus.
- Two moderate dependency advisories remain; see DEPENDENCIES.md for exact
  findings/exposure. No forced dependency upgrades were applied.

The release receipt in `release-checks/0.2.0.md` records final artifact checksums,
isolated package-only acceptance, configuration preservation and test boundaries.
v0.1.0 and its tested assets are preserved.
