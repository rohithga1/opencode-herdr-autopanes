# Security policy

## Report privately

Use GitHub's **Report a vulnerability** form:
<https://github.com/rohithga1/opencode-herdr-autopanes/security/advisories/new>.
Private vulnerability reporting was enabled and verified through GitHub's API
for this repository on 2026-11-22. Do not put credentials, private conversations,
socket data or sensitive logs in a public issue. There is no separate email
address advertised by this project.

Include the plugin/OpenCode/Herdr versions, a redacted reproduction and expected
impact. Do not send live tokens or private launch files. Response and fixes are
best-effort; this experimental project provides no response-time guarantee.

## Supported scope

This policy covers experimental 0.2.0 (including its bundled companion) and
the retained 0.1.0 release on the tested Ubuntu
26.04.1 LTS / OpenCode 2.3.2 / Herdr 0.9.5 combination. Other versions and
deployment models are unverified. Do not use it as an isolation boundary for
hostile tenants or agents.

## Local permissions and credentials

The plugin runs in your OpenCode TUI with your user's process, filesystem,
network and Herdr socket permissions. Viewers are ordinary local OpenCode TUIs.
There is no added sandbox. It opens no network listener and does not deliberately
expose OpenCode beyond its existing service configuration.

Child IDs/paths are validated before launch. Herdr commands and OpenCode
arguments use argument arrays; the shell command needed by `pane run` quotes
every token. Titles never become executable shell text.

The plugin checks the candidate server's identity against the connected TUI.
Accepted URLs are HTTPS or loopback HTTP origins, without URL credentials,
path prefixes, query strings or fragments. Preflight requests reject redirects.
Only the configured/discovered OpenCode Basic authentication context is used.
Explicit remote Basic auth is not live-verified: use only a trusted server.
The separately launched native TUI controls its own HTTP behavior; the plugin's
redirect policy is not a claim about all requests made by OpenCode.

Credentials go through a one-use mode-0600 file in a fresh mode-0700 temporary
directory, not shell arguments or subprocess error logs. The runner unlinks that
file before connecting. Credentials are then in the viewer process environment,
which is not secret from sufficiently privileged or same-user processes. Failed
launches are cleaned up where possible; crashes/unload races can leave private
files behind. Do not share your account or Herdr socket with untrusted users.
Installer configuration backups and new configuration files use mode 0600.

## Known limitations

- Pane ownership metadata (legacy labels accepted) and a terminal-context hash prevent accidental
  cross-terminal cleanup, not deliberate forgery by a same-user process.
- The preflight existence check and CLI attachment are not atomic. Deleting a
  session in between can hit OpenCode's missing-session behavior; no prompt is
  supplied by the plugin and it does not start replacement agent work.
- User-supplied executable/config overrides are trusted, as are the main TUI,
  service registration and local Herdr binary/socket. A compromised same-user
  process is outside this plugin's security boundary.
- Limits bound managed panes, not native agent execution, session-event traffic
  or total memory used by a hostile authenticated server.
- Nested delegation and fresh-process recovery of existing panes remain
  unverified live. Unsupported auth/workspace restrictions are in the README.
- There are unresolved moderate production dependency findings. Read
  [DEPENDENCIES.md](DEPENDENCIES.md) for advisory IDs, paths, exposure and fix
  constraints. Transitive status does not make a finding safe.
- The companion runs with the same user's permissions and can read local agent
  title/context data. Its pinned sources and third-party notices are bundled.
  Setup rejects incompatible existing companions instead of overwriting them.
- Auto-close is optional/off. Selecting a viewer permanently pins it. Event
  stream failure disables closing; a cross-process last-millisecond focus/work
  race cannot be eliminated without an atomic host API.
- Install/uninstall refuse symlink-managed configs and preserve private backups.
  Do not edit settings concurrently with setup. Later edits to managed sidebar
  tables require manual reconciliation; unrelated edits are preserved.

This is a maintainer-assisted source review and regression testing, **not an
independent audit**, and not a claim that the plugin is vulnerability-free.
