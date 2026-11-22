# Verification history

Tested environment: Ubuntu 26.04.1 LTS, OpenCode 2.3.2, Herdr 0.9.5,
Node 26.13.1 and npm 12.2.3. This is maintainer-assisted testing, not independent
certification. Private terminal captures and detailed local diagnostics are
kept outside the publication files.

## Initial implementation — 2026-11-21

The installed CLI help, bundled Herdr schema and exact-version V2 plugin/client
declarations were checked. The initial non-Herdr terminal verified real API
hierarchy filtering and two native background subagents returning results.
Two real OpenCode viewer TUIs attached to their existing child conversations
in isolated PTYs, without new conversation messages. This was not a live Herdr
layout test, and was not represented as one.

## Live Herdr acceptance — 2026-11-21

The owning TUI was identified by its explicit session attachment and inherited
Herdr pane/socket context, rather than by the shared server's old environment
or another client's focused pane.

An initial failure revealed that Herdr `pane run` can succeed with empty stdout.
The adapter had incorrectly treated this as invalid JSON and rolled back the
pane. The common adapter and its regression check were corrected. Commands were
also made available during active work, and recovery was narrowed to observed
descendants or one explicitly requested child ID.

After those fixes the following were observed live:

- Two concurrent native children automatically got uniquely labelled viewers
  displaying the correct child conversations, read/shell tools, IDs and replies.
  Results returned normally to the parent; launch focus stayed on the owner.
- Completed viewers stayed open. Two retained viewers plus two new viewers
  filled the four-pane cap. An excess native agent still completed normally;
  the owning TUI displayed an overflow warning naming the skipped child.
- A repeated native continuation kept its original viewer without duplicates.
  Viewer TUIs did not create recursive panes. Source hot reload did not create
  duplicates or remove retained panes.
- Manual closure did not resurrect a viewer automatically. Targeted retry
  reopened exactly one viewer for that child, leaving other viewers unchanged.
- An unrelated tree in the same project created no viewers for this owner,
  including actual native execution while all four managed slots were free.
- The cleanup slash command and confirmation removed owned viewers but left
  an unowned test sentinel and the main pane. A native child blocked on a FIFO
  survived viewer removal, resumed after release and returned successfully.
- The sentinel and temporary unrelated tree were removed separately. Final
  inventory contained only the original focused owner. The original CLI
  configuration remained unchanged.

During multi-pane closure, an immediate snapshot briefly showed focus on the
sentinel; a later snapshot showed the parent focused again. Uninterrupted focus
during Herdr's close-layout reconciliation is not claimed. Four viewers also
made the simple alternating layout narrow.

## First packaged candidate — 2026-11-22

The actual npm archive was installed in an empty prefix with production
dependencies and registered in an isolated configuration directory. A fresh
OpenCode TUI in a separate Herdr workspace loaded that installed copy and
delegated two native subagents concurrently. Both actual child transcripts,
normal parent results, uniquely named retained panes, packaged cleanup and
packaged uninstall passed. The original configuration and session were
preserved. See [release-checks/0.1.0.md](release-checks/0.1.0.md) for its digest
and the final release artifact receipt.

## Security hardening and final release

The source review added server-origin and child ID/path validation, redirect
refusal during preflight, server-response identity checks, private/exclusive
credential file creation, terminal-control stripping, private installer backups,
and refusal of symlink-managed or malformed settings. Relevant tests cover
these boundaries as well as tree filtering, layout serialization, duplicates,
cap/overflow, recursion prevention, failures, cleanup and recovery.

Final package checks and repeated live acceptance are recorded outside the
archive in [release-checks/0.1.0.md](release-checks/0.1.0.md).
See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) and [DEPENDENCIES.md](DEPENDENCIES.md)
for security scope and unresolved findings.

## Explicitly unverified live

- Native nested delegation: tested children lacked the delegation tool.
- Fresh-process recovery of **pre-existing retained panes**. Fresh startup,
  source hot reload and mocked label recovery are not substitutes.
- Explicit remote HTTPS Basic authentication.
- Other operating systems, OpenCode/Herdr versions or terminal shells.

Generated private standalone credentials, non-Basic authentication, URL tickets
or path-prefix servers, remote workspace IDs and cross-machine Herdr forwarding
are unsupported by this experimental version.
