# Verification history

## v0.2.1 close-completed/documentation acceptance — 2026-11-23

This release preserves the v0.1.0/v0.2.0 tags, release assets and checksums.
The final artifact receipt is [release-checks/0.2.1.md](release-checks/0.2.1.md).

The new palette/slash action `/herdr-autopanes-close-completed` reuses the
existing activity, ownership, focus/pin and final recheck gates. It closes only
finished viewers for the current owner. Running/blocked/unknown/failed viewers,
active descendants or background shells, pending forms/permissions, pinned
viewers, currently focused viewers and unverifiable ownership remain open.
Conversations and native sessions are preserved. Full-group cleanup remains
separate and broader.

The README was rewritten for first-time users, with the existing real grouped
sidebar capture near the top. `docs/workspaces.md` explains Herdr reconnect,
spaces, tabs, directories and workspace creation. `docs/demo-script.md` is the
short recording fallback; no video was staged.

Checks and live validation:

- 28 TypeScript tests passed, including scoped mixed-state close coverage:
  completed owned viewer closes; running viewer, focused viewer, pinned viewer
  and another owner's viewer remain.
- 4 unified setup tests, the grouping self-check, and 206 companion tests
  (20 optional skips) passed.
- README/workspace/demo links were checked locally; npm pack dry-run includes
  the workspace guide, recording script and grouped-sidebar image.
- In an isolated Herdr session/config root using the local patch, two
  orchestrators produced separate groups with two completed children each.
  A third child held on a FIFO remained `working` while completed viewers were
  present. The isolated viewers were then closed manually and the FIFO was
  released; the isolated server was stopped.
- An initial diagnostic attempt could not reliably submit a parent command to a
  non-focused OpenCode client; that limitation was not treated as a passing
  UI result. The final manual UI run did submit the real slash command from the
  parent and displayed **2 closed / 0 skipped / 0 failures**. The packaged
  v0.2.0 and user sessions were not changed.
- The confirmed original live cause was twofold: with automatic closing off,
  the TUI supplied `false` for every manual-close gate; with automatic closing
  on, the focus guard stored every focus event in one permanent `pinned` set.
  The fix makes the no-auto-close gate permissive, tracks current focus
  separately from explicit pins, and returns a counted reason summary.

Live rerun after the fix used a fresh Herdr session/config root and the local
checkout. Two parents each launched two harmless children. Both A children were
inspected in turn, focus returned to A, and the real
`/herdr-autopanes-close-completed` slash command removed both A viewer panes and
sidebar rows; B's unrelated group remained. In B, a completed eligible viewer
was removed while a viewer carrying explicit `ocap_pin=1` and a FIFO-backed
`working` viewer remained. The running FIFO was released and all isolated test
panes/server were stopped afterward. The focused-viewer gate and reasoned
summary are covered by regression tests; a separate client-focused viewer
cannot reliably receive a parent slash command through the diagnostic PTY.

The final v0.2.1 tarball was installed from its exact bytes in a fresh isolated
prefix and passed setup/doctor, installed-source regressions, package privacy
inspection and live two-parent close-completed behavior. Its SHA-256 is
`4258db3ff4048e56e6366dcb4bdf1012561d63da62e6f7c08e2c9a23f8637ce3`.

## v0.2.0 packaged-release acceptance — 2026-11-23

The grouped implementation is now reproducible from a single tarball containing
the pinned companion and unified setup. Final receipt:
[release-checks/0.2.0.md](release-checks/0.2.0.md).

Tested in a separate Herdr session with separate configuration, data/state and
OpenCode CLI roots, using only installed release files; neither development
checkout nor local modified companion was registered there. Real native agents
used the existing OpenCode service with test-only sessions/location. No user
service restart, new user workspace, npm publication or v0.1.0 replacement.

Both components loaded from the final package. Two orchestrators each produced
two concurrent child viewers in separate groups; real sidebar mouse events
selected correct child IDs/results full-size and returned to both parents.
Before/after geometry/focus matched. Completed viewers were retained. Four-viewer
overflow counted retained views, left the other group unchanged and allowed
all native work to complete. Cleanup was scoped to each owner.

Fresh setup, actual v0.1.0 artifact upgrade, rollback, repeated uninstall,
compatible-companion reuse and user-owned-companion preservation were tested.
Later unrelated CLI/Herdr settings survived. A changed managed sidebar table
was refused without overwriting it. A deliberately invalid test config caused
Herdr reload rejection; after correcting that fixture, journal-based uninstall
retry succeeded. The release files did not need a fix for that fixture error.

Checks: typecheck; 26 TypeScript regressions against both reviewed source and
final installed package; 4 unified-setup tests; grouping self-check; bundled
companion suite (206 tests, 20 optional font/tooling skips). A test-only TS loader
was used for Node's node_modules restriction; actual production loading was
independently verified through OpenCode.

The final package adds only documentation/capture changes to the first tested
candidate's runtime. Final bytes were installed again and real two-owner launch/
navigation checks repeated. Consumer audit: 25 moderate entries, same two
advisories, no high/critical. Companion runtime remains Python stdlib-only.

The sidebar image is a cropped, rasterized capture of actual test terminal
cells, not a fabricated interface or desktop screenshot. Private prompts,
credentials, logs, original configs and diagnostics are outside the repository.
The isolated server was stopped after acceptance; user sessions were preserved.

## Unreleased local grouped-viewer prototype — 2026-11-22

The later `local/grouped-viewers` interaction changes are **not** in v0.1.0.
The published release, its tag and both recorded artifact hashes are preserved.
See [docs/grouped-viewers.md](docs/grouped-viewers.md) for supported features,
the explicit companion extension, rollback and detailed live observations.

Local mode now defaults to background tabs in the existing workspace. The
companion's upstream `hs_parent` only recognizes contiguous same-tab children,
and an installed Herdr split clears zoom. Therefore guaranteed full-size
viewing plus parent/child grouping required a local companion extension rather
than presenting a flat tab list as a hierarchy.

Live checks covered two orchestrators in one workspace, distinct cross-tab
child groups, correct conversations/results after actual sidebar mouse clicks,
returning to each main agent, readable labels with hidden identity metadata,
retained completion, no additional workspaces, and no main-tab resizing during
background creation at fixed terminal dimensions.

An early optional-close prototype relied on Herdr's global focus snapshot and
proved unsafe with two clients. It was fixed before leaving the feature in this
branch: focus events now permanently pin selected viewers and observation
failure disables automatic closing. Native completion also checks ongoing
background shells, descendants and pending forms/permissions, not just the
last model-turn outcome. Repeated live checks confirmed working and inspected
viewers stayed open, an unseen completed viewer closed after the configured
8-second trial delay, and an actual pending form kept a completed-but-blocked
viewer open. The pending test form was removed afterward.

B's cleanup left all A viewers and both owners intact. A's cleanup removed
its own remaining viewers, leaving the owners. Final demonstration children were
then created under both owners with default retention restored, for user review.
No test agent was left waiting on a FIFO or pending form.

Current checks: typecheck and **26 TypeScript regression tests**, the original
adapter's grouping self-check, and **206 companion tests with 20 skips** passed.
The companion's registry was updated to describe the local extension; an initial
documentation-drift failure was corrected. Raw diagnostic client captures and
local backup contents remain private outside the repository.

The native release limitations below remain historical evidence for v0.1.0.
This iteration still does not claim native nested delegation or arbitrary
cross-process atomicity between a last-millisecond click/work admission and
a close already dispatched to Herdr. Automatic closing remains opt-in and
is disabled in the user's normal local configuration.

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
