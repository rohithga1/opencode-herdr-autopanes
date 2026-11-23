# Short real demonstration script

Video was not required for this local documentation update. The checked-in
[grouped sidebar capture](grouped-sidebar.png) is the reliable visual fallback.
If recording later, use a clean demo project with no private files:

1. Start `herdr` and run `opencode` in one project space.
2. Ask the main agent to launch two harmless native subagents that read only
   `LICENSE` and `package.json`.
3. Wait for both child rows to appear under the parent.
4. Click one child and show its full-size conversation/result.
5. Click the parent and show the orchestrator return.
6. In this unreleased local update, run
   `/herdr-autopanes-close-completed`; show completed viewer rows disappear.
7. Optionally run `/herdr-autopanes-cleanup` only after explaining that it has
   broader scope and does not cancel native work.

Use a separate Herdr session/config root for recording. Do not operate a
user's working agent panes, include credentials, or claim release v0.2.0 has
the unreleased close-completed action.
