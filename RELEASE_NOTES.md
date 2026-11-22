# v0.1.0 — Experimental OpenCode V2 autopanes for Herdr

When OpenCode delegates to native subagents, this plugin opens named Herdr
viewers on their existing conversations. Native background execution and result
delivery remain unchanged. Completed viewers stay open; the four-pane default
includes retained panes. Overflow warns without cancelling agents.

## Install and try

Download the `.tgz` and `SHA256SUMS` from
[this GitHub release](https://github.com/rohithga1/opencode-herdr-autopanes/releases/tag/v0.1.0),
verify the checksum, install the archive in a local prefix and run its packaged
`install:local` script. The package is not published to npm.

Follow the copy-and-paste [README installation instructions](https://github.com/rohithga1/opencode-herdr-autopanes/blob/v0.1.0/README.md#install-from-the-github-release).
Then start `opencode` inside Herdr and ask for two harmless parallel subagents.
Expect two child conversations, normal parent results and retained viewers.
Use `/herdr-autopanes-cleanup` to close owned viewers; child agents keep running.
The README also covers configuration, targeted retry and uninstall.

## Tested environment and evidence

Ubuntu **26.04.1 LTS**, OpenCode **2.3.2**, Herdr **0.9.5**, Node **26.13.1**,
npm **12.2.3**. No support beyond this tested combination is claimed.

Earlier local tarball testing covered an empty-prefix install, a fresh TUI,
automatic parallel child viewers, correct IDs/results, retention, cleanup and
packaged uninstall. The release receipt in
[release-checks/0.1.0.md](https://github.com/rohithga1/opencode-herdr-autopanes/blob/v0.1.0/release-checks/0.1.0.md)
identifies the final artifact and its repeated acceptance results.

## Security and limitations

The release adds URL/origin and child ID/path validation, rejects preflight
redirects, keeps launch credentials in private one-use files, and makes
configuration backups private. See
[SECURITY.md](https://github.com/rohithga1/opencode-herdr-autopanes/blob/v0.1.0/SECURITY.md)
for the verified private reporting channel and the limits of this source review.

- **Native nested delegation remains unverified live**: tested children lacked
  the delegation tool. Deep filtering has regression coverage.
- **Fresh-process recovery of existing retained panes is unverified live**.
  Fresh startup and hot reload are different tests.
- Alternating splits can make panes narrow; closing several panes may briefly
  shift focus. Launch focus and final parent focus were verified.
- Only reproducible local service or explicit OpenCode Basic credentials are
  supported. URLs must be HTTPS or loopback HTTP origins. Private generated
  standalone credentials, URL tickets/path prefixes, remote workspace IDs and
  cross-machine Herdr forwarding are unsupported. Remote Basic auth is unverified.
- **24 moderate dependency-package findings remain** (25 in consumer-prefix
  audits, including this package's propagated entry), from two glob/minimatch
  advisories in the production dependency tree. No forced upgrades or arbitrary
  downgrades were made; see
  [DEPENDENCIES.md](https://github.com/rohithga1/opencode-herdr-autopanes/blob/v0.1.0/DEPENDENCIES.md).

MIT license, copyright 2026 rohithga1. This is a GitHub **prerelease**, not a
stable-support promise or an npm publication.
