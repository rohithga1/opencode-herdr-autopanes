# Release source review — 2026-11-22

This is a maintainer-assisted implementation review, not an independent audit
or a guarantee of absence of vulnerabilities.

## Checked and hardened

- **Commands:** execFile/spawn use arrays. The sole POSIX shell string consists
  only of individually quoted executable/runner/config-file tokens. Titles are
  separate rename arguments, with C0/C1 terminal controls removed. Session IDs
  must have the target version's `ses_` alphanumeric shape; working directories
  must be absolute and control-free, so they cannot become CLI option injections.
- **Hierarchy:** every lookup must return the requested identity. Ancestry is
  walked to the captured owner with cycle detection. Unrelated trees are filtered
  before touching layout. Recovery reuses these same checks.
- **Ownership:** the caller TUI supplies the socket/pane/workspace. Cleanup and
  cap checks use its context-specific label prefix. Labels are bookkeeping, not
  authentication against a malicious same-user process.
- **Recursion/resources:** viewers carry a disabling marker. Session claims and
  a reload-shared serial queue prevent accidental duplicate launches. The default
  four-pane cap includes retained panes. This does not bound native agents,
  malicious server-event traffic or total memory consumption.
- **Credentials/network:** only known local discovery or explicit configured
  origins are tried. Candidate identity is checked against the current client.
  Origins reject userinfo, paths, query tickets, fragments, non-HTTP(S) protocols
  and non-loopback cleartext HTTP. Preflight fetches refuse redirects. The native
  TUI remains responsible for its own later HTTP behavior.
- **Private files:** mkdtemp makes a private directory; launch files are created
  exclusively at mode 0600 and consumed/unlinked before connection. Malformed
  launch data is not echoed in exceptions. Subprocess failures are reported
  without command arguments or stderr containing private data. Crashes can still
  leave private files, and same-user/privileged processes can read environments.
- **Installer:** only the exact absolute package registration is added/removed;
  unrelated JSON settings/entries remain. Backups are exclusive and mode 0600.
  Malformed/non-object configs and symlink-managed files are refused. A changed
  file is checked before rename. There is no claim of a cross-process locking
  protocol with other editors; avoid concurrent settings writes.
- **Exposure:** the plugin opens no server listener and does not call service
  startup APIs. Remote endpoints and executable/config overrides are trusted
  operator input, not a new sandbox for hostile agents.

## Remaining uncertainty and findings

The existence preflight and native CLI attachment are not atomic. Session
deletion in between may encounter OpenCode's create-if-missing behavior, though
the plugin supplies no prompt and starts no replacement work.

Cold-process recovery, native nested delegation and remote Basic authentication
remain unverified live. Narrow layouts and transient close-time focus changes
were actually observed. The 24 moderate production package findings remain
visible in [DEPENDENCIES.md](DEPENDENCIES.md); being transitive does not make
them safe. Neither the full OpenCode binary nor arbitrary server configurations
were audited.

Private GitHub vulnerability reporting was enabled and verified for the project;
[SECURITY.md](SECURITY.md) links to the actual reporting form.

Publication scanning covers the intended source files, Git history and archive
contents; the release receipt records its result. Raw local diagnostics,
authentication/config files, original detailed operational captures, dependency
directories and generated archives are not committed as source. No third-party
implementation was copied; the existing MIT holder remains unchanged.
