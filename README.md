# OpenCode Herdr Autopanes

When OpenCode delegates to subagents, this plugin automatically opens Herdr panes so you can watch their work.

Ask your main agent to run two jobs in parallel. Each native child session gets
a named pane showing its actual conversation and tools. Results return to the
main agent normally, and completed panes stay open for inspection. The plugin
does not repeat prompts or replace OpenCode's delegation.

> **Experimental v0.1.0 prerelease.** Tested only on Ubuntu 26.04.1 LTS,
> OpenCode 2.3.2 and Herdr 0.9.5. Node.js 26.13.1 and npm 12.2.3 were used for
> validation. The package declares Node 22.18+, but other environments are
> unverified. Expect rough edges and the limitations below.

## Before you install

- Have OpenCode **2.3.2** and Herdr **0.9.5** installed. No upgrade is required.
- Have `node`, `npm`, `curl`, and `sha256sum` available on the server.
- Run your main OpenCode TUI **inside a Herdr pane**. The normal local shared
  OpenCode service is the recommended connection.
- Install only one copy of this plugin. If you previously registered a checkout,
  run its `npm run uninstall:local` before switching copies.

## Install from the GitHub release

**Run in a regular server shell**, not in OpenCode's prompt. These commands
download the actual release artifact; the package is **not published to npm**.

```sh
mkdir -p "$HOME/Downloads/opencode-herdr-autopanes-0.1.0"
cd "$HOME/Downloads/opencode-herdr-autopanes-0.1.0"
release="https://github.com/rohithga1/opencode-herdr-autopanes/releases/download/v0.1.0"
curl --fail --location --proto '=https' --tlsv1.2 -O "$release/opencode-herdr-autopanes-0.1.0.tgz"
curl --fail --location --proto '=https' --tlsv1.2 -O "$release/SHA256SUMS"
sha256sum --check SHA256SUMS

prefix="${XDG_DATA_HOME:-$HOME/.local/share}/opencode-herdr-autopanes"
npm install --prefix "$prefix" --omit=dev "$PWD/opencode-herdr-autopanes-0.1.0.tgz"
pkg="$prefix/node_modules/opencode-herdr-autopanes"
npm --prefix "$pkg" run install:local
```

Keep that installation directory while the plugin is enabled. No source
checkout or build is needed. The checksum detects download corruption; it is
not a separate cryptographic signature from the maintainer.

The installer adds the package's absolute path to `~/.config/opencode/cli.json`.
It preserves other settings/plugins and writes a timestamped, mode-0600 `.bak`
before modifying an existing file. Installation is idempotent. Invalid JSON
causes an error without changing the configuration. The installed Herdr
integration is not replaced.
Symlink-managed `cli.json` files are refused rather than replacing the link;
register the plugin manually if your dotfile manager requires a symlink.

`XDG_CONFIG_HOME` and `OPENCODE_CONFIG_DIR` are respected. For an isolated trial,
set `OPENCODE_CONFIG_DIR` to a separate directory **before registration** and use
the same environment when launching OpenCode. This overrides OpenCode's config
directory for that TUI; it is not just a plugin setting.

CLI settings are watched and reload live; **no shared-server restart is needed**.
If you installed while outside Herdr, open a fresh TUI inside Herdr rather than
trying to change an existing process's environment. If the status command is
missing, check the plugin configuration or open a fresh TUI; do not restart the
server or stop running agents just to apply the plugin.

## First use

**In a shell inside Herdr**, change to your project and start OpenCode:

```sh
cd /path/to/your/project
opencode
```

**In OpenCode**, try `/herdr-autopanes-status`, then ask:

> Run two harmless native subagents in parallel. One reads README.md; the other
> reads LICENSE. Each should return its own session ID and a one-line summary.

You should see two named panes appear without taking focus from the main pane.
Each displays the corresponding child conversation, and both summaries return
to the parent. The panes stay open after completion.

The first selected session owns this TUI's descendant tree. Browsing another
session does not transfer ownership; use another main TUI in its own Herdr pane
to watch a different tree. Viewer panes cannot create more viewers. These are
normal OpenCode TUIs, **not enforced read-only clients**.

## Pane limit and configuration

The default is **four plugin-managed panes per owning terminal**. Completed
panes count toward the limit. If all slots are occupied, the plugin reports the
skipped session; **the agent still runs and returns results normally**. It does
not close retained panes or cancel work to make space.

In your existing `cli.json`, change this plugin's string entry to an object:

```json
{
  "plugins": [
    {
      "package": "/absolute/install/prefix/node_modules/opencode-herdr-autopanes",
      "options": { "maxPanes": 4 }
    }
  ]
}
```

Use the absolute package path printed by the installer, and keep your other
plugin entries. Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `maxPanes` | `4` | Positive integer; includes retained completed viewers |
| `server` | Main TUI's `--server`, then local service discovery | Explicit origin for reproducing the same server connection; no password in this option |

`OPENCODE_HERDR_BINARY` can override the viewer executable. By default the
plugin uses the main TUI's own executable. This is trusted local configuration,
not an agent-controlled command.

## Cleanup is not cancellation

Use these slash commands **inside the owning OpenCode TUI**:

| Command | Action |
| --- | --- |
| `/herdr-autopanes-status` | Show the terminal context or why viewing is inactive |
| `/herdr-autopanes-cleanup` | Confirm, then close only this terminal's plugin-labelled viewers |
| `/herdr-autopanes-retry SESSION_ID` | Retry a specific descendant after a failure, overflow or manual closure |
| `/herdr-autopanes-retry` | Retry descendants already observed by this TUI |

Cleanup removes viewers, **not the native child sessions**. Agents keep running
on OpenCode's server. Cancelling an agent is a separate native OpenCode action.
Closing a pane manually does not automatically reopen it; retry explicitly.

## Troubleshooting

- **No panes:** check the status command and plugin entry. `node` and `herdr`
  must be on PATH. Only new creation/execution events are automatic; use retry
  with an explicit descendant ID for older work.
- **Wrong terminal context:** launch the main TUI inside Herdr. Do not manually
  spoof `HERDR_ENV` or guess a socket. The plugin uses the TUI's own pane/socket,
  never the shared server's environment or Herdr's focused-pane fallback.
- **Pane limit reached:** completed panes still count. Close unwanted viewers
  or use cleanup, then retry. Freeing a slot does not automatically replay overflow.
- **Failed viewer:** inspect its terminal output and the warning toast. A
  retained failed viewer also counts until closed. Process startup acknowledgement
  does not prove successful TUI rendering.
- **Authentication:** local shared-service credentials are discovered without
  starting another server. For an explicit server, inherit `OPENCODE_PASSWORD`
  (or `OPENCODE_SERVER_PASSWORD`) when launching the main TUI. Only Basic auth
  with the OpenCode username is supported. URLs must be HTTPS or loopback HTTP
  origins, without userinfo, path prefixes, query tickets or fragments. Preflight
  checks reject redirects. Never put secrets in a URL or plugin options.

## Known limits and security

- Splits alternate right/down; this is not adaptive tiling. Four panes can make
  the main pane narrow. Launch focus was preserved in testing; closing multiple
  panes can briefly shift focus while Herdr reconciles layout.
- **Native nested delegation is unverified live:** the tested child did not have
  a delegation tool. Deep ancestry filtering has regression-test coverage.
- **Fresh-process recovery of existing retained panes is unverified live.**
  Fresh startup and hot reload passed, but those are different tests.
- Private standalone servers with inaccessible generated credentials, non-Basic
  auth, remote workspace IDs and cross-machine Herdr forwarding are unsupported.
  Explicit remote HTTPS Basic auth has not been live-tested.
- Herdr's existing integration may report the family root in `agent_session`
  metadata even when the viewer displays the correct child conversation.
- Ownership labels are local bookkeeping, not protection against other processes
  running as your user. Renaming their prefix or moving panes to another
  workspace prevents reliable recovery/cleanup. A crash between split and naming
  can leave an unlabelled pane that the plugin will not guess ownership of.
- Abrupt termination can leave a private `herdr-viewer-*` directory under
  OpenCode's temporary directory. Remove a specific stale directory only after
  confirming its viewer is gone. Do not delete live viewers' directories.
- The reviewed dependency tree still has **24 moderate affected-package findings**
  from two advisories (**25** in a consumer prefix, including this package's
  propagated entry). These are not proof of exploitation, nor are they dismissed
  as harmless. Read [SECURITY.md](SECURITY.md), [DEPENDENCIES.md](DEPENDENCIES.md)
  and the [release notes](RELEASE_NOTES.md) before deciding where to run it.

## Uninstall

First run `/herdr-autopanes-cleanup` inside OpenCode if you want its viewers
closed. **In a regular server shell**, using the same config environment as setup:

```sh
prefix="${XDG_DATA_HOME:-$HOME/.local/share}/opencode-herdr-autopanes"
npm --prefix "$prefix/node_modules/opencode-herdr-autopanes" run uninstall:local
npm uninstall --prefix "$prefix" opencode-herdr-autopanes
```

Unregistration backs up the configuration again and removes only this package's
exact path, including its object/options form. Other settings, sessions and
panes remain. No server restart is needed. Do not restore an entire old backup
over newer unrelated edits.

## Contributing

Issues and focused pull requests are welcome at
[the GitHub repository](https://github.com/rohithga1/opencode-herdr-autopanes).
For security issues use the private channel in [SECURITY.md](SECURITY.md).
From a development checkout run `npm ci`, `npm run typecheck`, and `npm test`.
Keep V2 2.3.2 compatibility, preserve native delegation, and state clearly whether
a check was mocked or exercised in real Herdr. See [VERIFICATION.md](VERIFICATION.md)
and [release-checks](release-checks/) for release evidence.

Licensed under the [MIT License](LICENSE), copyright 2026 rohithga1.
