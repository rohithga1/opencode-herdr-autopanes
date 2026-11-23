# Grouped full-size viewers — design and prototype evidence

The sections below record the local prototype that preceded v0.2.0. For the
reproducible **bundled v0.2.0 installation**, use the root README and
`scripts/setup.py`; the historical checkout/patcher instructions below are not
the release installation flow. The v0.1.0 release and its receipt remain unchanged.
The pinned companion is now shipped in `companion/` with attribution, licenses,
local modifications and file hashes; no unpublished checkout is required.

## What Herdr 0.9.5 actually supports

Installed 0.9.5 help and protocol-22 schema expose pane-backed agent rows, tabs,
metadata tokens, custom row rendering and `agent.view.set` sorting. No supported
API was found for a terminal-free child session row that creates a viewer only
when selected. This prototype therefore starts real background viewer terminals.

The unmodified companion at
[testy-cool/herdr-sidebar-config](https://github.com/testy-cool/herdr-sidebar-config),
commit `8a45adc5c0dd02f5cffeae5e900738035c9b3b82`, accepts `hs_parent` only when
the parent precedes its contiguous children **in the same tab**. Both its
`child_parents` implementation and its tests explicitly reject cross-tab parents.
Native tab sorting plus repeated group labels is not equivalent to grouping.

Same-tab zoom was also tested against real 0.9.5: `pane split --no-focus` clears
zoom. Thus same-tab hidden splits cannot promise that launching children leaves
the orchestrator full-size. Trying to re-zoom afterward would allow a resize
flash and might steal focus. This approach was rejected, not shipped as a fix.

## Chosen interaction

Each child gets one tab with one pane, **in its owner's existing workspace**.
`tab create --no-focus` leaves the original tab, split geometry, zoom and focus
alone. No extra workspace is created. These are already-running background
terminals, not lazy sidebar records.

The main OpenCode session owns its own group. The sidebar renders:

```text
Main agent A       [working]
  |-- Read license  [done]
  `-- Check package [done]
Main agent B       [idle]
  |-- Review config [working]
  `-- Read docs     [done]
```

This is an explanatory text diagram, not a screenshot. Real metadata uses the
companion's standard tree lines/status marks and **text** provider labels (`OC`),
so no custom font is needed. Names may still clip to sidebar width. The local
sidebar width was changed to 36 columns after backing up its configuration.

Click a child row for its full-size conversation. Click its parent row to return
to that orchestrator. It is a real cross-tab parent/child tree, but is visual,
not collapsible. Original tab order is left intact; sidebar display order alone
is changed. Orphans or cross-workspace parent references are not grouped.

## Explicit companion extension

**Stock companion behavior is insufficient.** This prototype installs an
original integration module and narrowly patches the local companion:

- `integrations/sidebar_groups.py` recognizes explicit `ocap_parent`,
  `ocap_owner`, `ocap_session` and matching `hs_parent` metadata.
- It orders each owner followed by its own children and gives the renderer
  logical same-tab copies for indentation. The actual tab IDs/layouts and pane
  IDs used as native click targets are never changed.
- The companion owns Herdr's one agent-view override, sorting by a hidden
  `hs_autopanes_rank`. It reverts to its normal sorting when these groups disappear.
  Do not combine it with a different agent-filter/sort plugin.
- `ocap_status` is a display-only fact supplied by the owning OpenCode client.
  The existing Herdr OpenCode integration can otherwise report family-root
  status/session metadata for a viewer. No synthetic lifecycle reports or agent
  prompts are issued by this extension.
- Readable names use `hs_title` and pane/tab labels. Full identity and terminal
  ownership are hidden `ocap_*` tokens, not display labels. Legacy v0.1.0 labels
  remain recognized for recovery/cleanup.

The companion checkout is installed locally at
`~/.local/share/herdr-sidebar-autopanes`; it retains its own MIT license and
third-party notices. No upstream artwork/font or companion implementation is
vendored into this plugin. These extensions are not available just by downloading
the existing v0.1.0 tarball.

### Reproduce the local setup

Use a retained companion checkout at the inspected commit. Run these **inside
the intended Herdr session**, from this plugin checkout:

```sh
python3 scripts/patch-sidebar.py /path/to/herdr-sidebar-config
python3 /path/to/herdr-sidebar-config/setup_sidebar.py install --text --dry-run --json
python3 /path/to/herdr-sidebar-config/setup_sidebar.py install --text --json
python3 /path/to/herdr-sidebar-config/setup_sidebar.py doctor --json
```

The patcher refuses source shapes it does not recognize and keeps `.before-autopanes`
backups of modified companion files. Its registry/checker updates acknowledge
the new module/token instead of hiding documentation-test drift.

The companion's setup keeps an original-byte backup at
`~/.config/herdr/herdr-sidebar-setup/install.json` (private; do not publish).
It merges its sidebar rows, workspace-name dimming and workspace sorting, plus
an unclaimed settings shortcut. Theme and unrelated settings are preserved. No
font installation or VS Code font setting is needed in `--text` mode.

For this user's active shared service, shell tools inherited the older server's
environment. Acceptance commands used only the Herdr context of the actual
TUI explicitly attached to this session, never guessed focus or a random socket.
That diagnostic helper is private and is not part of the integration.

### Rollback

First run `/herdr-autopanes-cleanup` if the test viewers are no longer needed.
Use the companion's `setup_sidebar.py uninstall --dry-run --json`, then uninstall
from its retained checkout to restore only the managed configuration settings.
Its backups preserve unrelated later edits; inspect any conflict rather than
restoring the whole old config over new settings. The separately added
`ui.sidebar_width` can be removed to return to the old width.

Do not update the patched companion in place without reviewing the extension.
The local `.before-autopanes` files preserve upstream bytes for source rollback.
Switching this plugin back to `mode: "split"` restores split layout behavior for
future launches; it does not move existing tabs or erase ownership tokens.

## Options and completion safety

Local options (merge into the existing package entry, not the entire file):

| Option | Default | Meaning |
| --- | --- | --- |
| `mode` | `"tabs"` | One background tab per child; `"split"` keeps old split mode |
| `maxPanes` | `4` | Maximum owned viewers per terminal, including retained ones |
| `closeOnCompletion` | `false` | Optional closing of safe, uninspected completed viewers |
| `closeDelaySeconds` | `60` | Minimum quiet-completed delay; nonnegative finite number |

The user's normal local entry explicitly uses tabs, limit four, retention enabled,
and a 60-second close delay if auto-closing is enabled later. The optional closing
test used a separate config for the temporary second orchestrator, not the user's
retention policy.

An OpenCode `execution.succeeded` event can mean only that a model turn ended:
a shell or descendant may still run. Completion safety also checks active native
sessions, attributed background shells, permissions and forms, including
descendants. Unidentified running shells conservatively retain viewers at that
location. API errors/unknown state also retain them.
Failed sessions are marked `[failed]` in the sidebar and retained rather than
automatically removed, so an error is not disguised as successful completion.

Herdr's snapshot exposes one current focus, not all attached clients' viewports.
Consequently the optional closer subscribes to supported pane-focus events and
**permanently pins a viewer once selected**. It does not close that viewer later
just because another client or tab is focused. Existing viewers are pinned on
initialization/reload, and observation failure disables automatic closing.
Use manual close or ownership-only cleanup for pinned views. Retention is the
safe default.

Checks are repeated immediately before a close, but Herdr has no atomic
“close only if still uninspected and native-idle” transaction shared with
OpenCode. A click/work-admission racing an already-dispatched close cannot be
made an absolute cross-process guarantee. Closing a viewer still never cancels
the native session; avoid enabling auto-close if that residual race is unacceptable.

## Live observations — 2026-11-22

Environment unchanged: Ubuntu 26.04.1 LTS, OpenCode 2.3.2, Herdr 0.9.5.
No additional workspaces, service restarts, font changes or published assets.

- Two native A children ran concurrently, returned IDs/results to A and opened
  background tabs with correct child conversations and retained completed views.
- A second test orchestrator B ran in another tab of the **same workspace**.
  Its own two children appeared only beneath B, never beneath A.
- B initially hit its configured provider's usage limit. The test B sessions
  were switched to the already-working model used by A and resumed normally.
  This was not an Autopanes layout failure or a change to the user's main model.
- A real Herdr client was rendered in a diagnostic PTY. Actual sidebar mouse
  events selected A's child, B's child and each parent. Captured terminal output
  showed the correct IDs/results. Each target tab contained one full-size pane,
  with no splits. This is not a mocked click or invented screenshot.
- Native creation in tab mode produced no split/zoom/resize call. With client
  dimensions held constant, before/after API snapshots confirmed unchanged main
  tab rectangle, splits, zoom and focus while a new B child launched.
  Earlier mismatches were traced to attaching a diagnostic client with a
  different terminal size, then corrected; those were not claimed as passing
  no-resize tests.
- Default retention left completed A/B viewers accessible. Optional 8-second
  closing removed never-selected completed B viewers, without touching A's
  viewers. A selected B viewer stayed retained beyond the delay.
- An early auto-close trial exposed the multi-client focus-snapshot problem.
  After adding the event-stream pin and background-work checks, the affected
  trial was repeated: a native FIFO shell remained visible as working, then
  returned its normal result after release; the selected completed viewer stayed
  present while another unseen completed viewer closed.
- The local adapter self-check covers two owners, cross-workspace rejection,
  orphans and no mutation of real tab facts. The companion's full suite passed
  **206 tests with 20 skips** after documenting its local extension. The first
  run's known registry drift was corrected, not ignored.

Further final cleanup/retention checks are recorded in VERIFICATION.md.
Blocked-session safety has regression coverage; a real pending form was also
used for the final acceptance trial, separate from normal delegation.
Nested native delegation is still not claimed by this iteration.
