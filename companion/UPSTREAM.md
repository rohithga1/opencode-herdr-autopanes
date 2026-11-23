# Bundled Herdr Sidebar

Upstream: https://github.com/testy-cool/herdr-sidebar-config
Exact revision: `8a45adc5c0dd02f5cffeae5e900738035c9b3b82`
Upstream component version: **0.3.0**
Autopanes extension revision: **0.2.0** (distributed with Autopanes 0.2.0).
Tested host: Herdr **0.9.5**, Python **3.14** (requires 3.11+).

This is a pinned source snapshot, not an upstream checkout or automatic update.
The upstream MIT copyright and permission notice are preserved in LICENSE.
Font/artwork attribution, Apache-2.0 and MIT licenses and trademark caveats are
preserved in assets/THIRD_PARTY_NOTICES.md and assets/licenses/. The recommended
installer selects text labels and installs no fonts. Upstream images illustrate
upstream behavior, not evidence for this release.

Local modifications (Copyright (c) 2026 rohithga1, MIT):

- `autopanes_groups.py`: original cross-tab grouping/status adapter, matching
  `../integrations/sidebar_groups.py`.
- `sidebar.py`: calls that adapter and publishes hidden ordering ranks.
- `tools/check_knowledge_docs.py`, `docs/knowledge/registry.json`: record the
  extension module and ordering token.
- `setup_sidebar.py`: exclusive private temporary writes, nonregular-file
  refusal, and refusal to overwrite later edits to managed sidebar settings.

The companion keeps its upstream plugin ID to prevent duplicate reporters.
`scripts/setup.py` verifies this snapshot's file hashes before install/reuse,
refuses customized/conflicting installations, and journals which component it
owns. No upstream branch is fetched during installation. Update only as a
reviewed Autopanes release; do not run `git pull` here.
