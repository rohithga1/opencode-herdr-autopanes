# OpenCode Herdr Autopanes

**Watch OpenCode subagents from a grouped sidebar without splitting your main terminal.**

Native subagents appear beneath their main agent in Herdr's left sidebar.
Click a named child to inspect its conversation full-size; click its parent to
return. Each viewer is a real background terminal tab in the **same workspace**.
Launching children does not split, resize or steal focus from your main tab.
Completed views stay available.

![Two main agents with separately grouped child viewers](docs/grouped-sidebar.png)

Real Herdr terminal-cell capture from the isolated package test, cropped to the
sidebar and rasterized for display. Test conversation names; not a desktop screenshot.

**Experimental v0.2.0.** Tested on Ubuntu 26.04.1 LTS, OpenCode **2.3.2**,
Herdr **0.9.5**, Node **26.13.1**, npm **12.2.3**, Python **3.14.4**.
The setup currently supports Linux and requires Python **3.11+**, Node
**22.18+**, npm, `curl`, `sha256sum`, and working `opencode`/`herdr` commands.
Only the exact environment above was tested; the installer requires Herdr 0.9.5.

**Grouping uses the bundled companion extension**, not stock `hs_parent`.
Herdr's stock rows require a terminal; upstream `hs_parent` groups only adjacent
same-tab panes. We bundle Herdr Sidebar **0.3.0**, pinned at
`8a45adc5c0dd02f5cffeae5e900738035c9b3b82`, with Autopanes extension **0.2.0**.
No upstream branch is fetched. Text labels (`OC`) need no extra fonts in VS Code.
See [attribution and changes](companion/UPSTREAM.md).

## Install from the GitHub release

Run shell commands **inside a terminal in the intended Herdr session**.
Do not run setup from an OpenCode prompt. No `sudo` is needed.
Use this versioned, stable directory rather than a development checkout:

```sh
mkdir -p "$HOME/.local/share/opencode-herdr-autopanes/0.2.0"
cd "$HOME/.local/share/opencode-herdr-autopanes/0.2.0"
curl -fLO https://github.com/rohithga1/opencode-herdr-autopanes/releases/download/v0.2.0/opencode-herdr-autopanes-0.2.0.tgz
curl -fLO https://github.com/rohithga1/opencode-herdr-autopanes/releases/download/v0.2.0/SHA256SUMS
sha256sum -c SHA256SUMS
npm install --prefix "$PWD" --ignore-scripts --save-exact ./opencode-herdr-autopanes-0.2.0.tgz
python3 node_modules/opencode-herdr-autopanes/scripts/setup.py install --dry-run
python3 node_modules/opencode-herdr-autopanes/scripts/setup.py install
python3 node_modules/opencode-herdr-autopanes/scripts/setup.py doctor
```

This downloads the release artifact and installs npm dependencies; it does **not**
publish anything to npm. The tarball contains both components and their licenses.
Do not move or delete the versioned directory while either component is registered.

### Upgrade from v0.1.0

First download, checksum and `npm install` v0.2.0 as above. Keep your old package
directory for rollback. Find its exact absolute `package` path in
`~/.config/opencode/cli.json` (or your configured CLI directory), then run:

```sh
OLD="/absolute/path/to/old/node_modules/opencode-herdr-autopanes"
NEW="$HOME/.local/share/opencode-herdr-autopanes/0.2.0/node_modules/opencode-herdr-autopanes"
python3 "$NEW/scripts/setup.py" install --upgrade-from "$OLD" --dry-run
python3 "$NEW/scripts/setup.py" install --upgrade-from "$OLD"
python3 "$NEW/scripts/setup.py" doctor
```

The old registration is replaced, not duplicated. v0.2.0 applies its tab,
four-viewer and retention defaults; other plugin options are preserved.
Existing viewers are not moved or closed. Prefer cleaning up old viewers with
v0.1.0's cleanup command before switching, if you no longer need them.
The original v0.1.0 release/tag/assets remain available.

### Existing sidebar installations

Setup reuses a companion only if all bundled files match and it is already
enabled, correctly configured and in text mode. Reused installations remain
user-owned and are not removed by Autopanes uninstall.

A stock, customized or earlier local-prototype companion will be refused with
its files intact. Keep its checkout and backups; use **its own setup uninstall**
flow, then `herdr plugin unlink testy-cool.herdr-sidebar`, before installing
the bundle. Do not overwrite a customized checkout with release files.
Other detected `agent.view.set` plugin reporters are refused. Herdr has a
single sidebar view override; do not run competing sidebar reporters.

### What setup changes

- Adds/replaces only this plugin's entry in OpenCode's `cli.json`.
- Links the bundled `testy-cool.herdr-sidebar` companion from the stable package.
- Merges Herdr agent rows, workspace-name dimming, `agent_panel_sort = "spaces"`
  and a settings shortcut only if unclaimed. It does not change fonts or width.
- Saves private configuration backups and an ownership journal next to the
  affected configs. Unrelated settings are preserved.

OpenCode watches CLI settings; Herdr setup reloads its configuration and
refreshes the sidebar. **No service restart is required.** If your TUI has no
session selected, select the intended main conversation. That first session
owns this terminal's group. For another orchestrator, use another Herdr tab/TUI.

## Try it

Ask your main OpenCode agent:

> Launch two native subagents concurrently: “Read license” should summarize
> LICENSE; “Read package” should summarize package.json. Do not change files.
> Return both results normally.

The two named rows appear beneath that main agent. Click either child for its
conversation; click the main row to return. Separate orchestrators have separate
groups even in one workspace. Status is readable without a provider icon font.
The tree is visual, not collapsible. Long names may clip; widen the sidebar in
Herdr settings if desired.

### Limits, inspection and cleanup

The default is **four viewers per owning terminal/orchestrator**, including
retained completed viewers. Overflow warns and skips the viewer; native agents
continue and return normally. Close an old viewer to free a slot, then use:

```text
/herdr-autopanes-status
/herdr-autopanes-retry CHILD_SESSION_ID
/herdr-autopanes-cleanup
```

Cleanup asks for confirmation and closes only this terminal's owned viewers.
It never cancels native agents. During active work, use `Ctrl+P` →
**Close plugin-owned Herdr viewers** if slash input is unavailable.
Manual closing does not automatically reopen a viewer; targeted retry does.

### Options

Edit only the `options` of this package entry in `cli.json`:

```json
{
  "mode": "tabs",
  "maxPanes": 4,
  "closeOnCompletion": false,
  "closeDelaySeconds": 60
}
```

`mode: "split"` keeps the earlier alternating split layout available.
`maxPanes` accepts positive safe integers. Completed views count in either mode.
Automatic closing is **off by default**. If enabled, it waits the configured
nonnegative delay, checks native background work/descendants and blockers, then
rechecks before closing. Unknown/error/failed states are retained.

**Selecting a viewer permanently pins it against auto-close**, even after
returning to the main agent. Existing viewers are pinned on reload; failure of
the focus-event stream disables auto-close. Use manual close/cleanup for pins.
Herdr has no atomic transaction with OpenCode to guard a click or resumed work
racing an already-dispatched close; retention remains the safest default.

## Uninstall or roll back

Run from a shell inside the same Herdr session. First clean up viewers if desired.

```sh
NEW="$HOME/.local/share/opencode-herdr-autopanes/0.2.0/node_modules/opencode-herdr-autopanes"
python3 "$NEW/scripts/setup.py" uninstall --dry-run
python3 "$NEW/scripts/setup.py" uninstall
```

This unregisters the owned components, restores only owned sidebar settings,
and preserves unrelated later edits. Customized managed sidebar tables cause
a refusal, not an overwrite: reconcile them using the private backup before
retrying. Preferences, package files and backups remain for inspection. You can
remove the versioned directory after unregistering; never remove a reused
companion's files.

For a v0.1.0 upgrade rollback, use `rollback` **instead of** `uninstall`:

```sh
python3 "$NEW/scripts/setup.py" rollback --dry-run
python3 "$NEW/scripts/setup.py" rollback
```

This restores the recorded old registration and removes only our companion
changes. Changed plugin options require manual reconciliation before rollback.
Keep the old package directory installed. Companion updates arrive only with
a reviewed Autopanes release; do not update this pinned snapshot independently.

## Authentication and limitations

- Local managed service discovery or an explicit HTTPS/loopback-HTTP origin.
  No URL userinfo, path, query or fragment credentials; non-loopback cleartext
  HTTP is rejected. Remote custom-header, cookie and bearer-token auth are not
  supported. Basic auth uses private launch data; remote HTTPS Basic remains
  unverified live. Never put credentials in a sidebar title or release report.
- Background viewers are real OpenCode TUIs and consume resources. They attach
  to existing native sessions without replaying prompts or replacing delegation.
- Ownership metadata prevents accidental cross-group cleanup, not malicious
  same-user tampering. Sidebar metadata may expose task names locally.
- Native nested delegation and cold-process recovery of retained viewers are
  **not verified**. Cleanup can cause transient Herdr focus changes.
- Conflicting view overrides created by external scripts/compiled plugins cannot
  all be discovered in advance. Use one sidebar reporter.
- Known moderate dependency advisories remain; see [DEPENDENCIES.md](DEPENDENCIES.md).

Details: [verification](VERIFICATION.md), [grouped interaction](docs/grouped-viewers.md),
[security](SECURITY.md), [review](SECURITY_REVIEW.md), [release notes](RELEASE_NOTES.md).
MIT for our code; the bundled companion retains its own copyright and notices.
