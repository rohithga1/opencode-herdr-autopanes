# Dependency advisory review — rechecked 2026-11-22

## What the count means

`npm audit --json` reports **24 moderate affected-package entries**, not 24
independent vulnerabilities. There are **two underlying published advisories**;
the other entries are transitive/metavulnerability propagation. No high or
critical findings were reported.

Installing the tarball in an empty consumer prefix reports **25** moderate
entries: the same 24 dependencies plus `opencode-herdr-autopanes@0.1.0` itself
as a propagated/metavulnerability entry. This is not a third underlying advisory
or evidence of a newly discovered plugin exploit. The consumer audit was checked
explicitly, not inferred from the development checkout.

1. [`GHSA-3g3m-2fjr-6pw4`](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4):
   glob's AbortSignal cancellation bypass permits filesystem traversal to
   continue after cancellation. Affected range: `>=9.0.0 <=14.0.1`.
   First version outside that range: **14.0.2**.
2. [`GHSA-g3hv-75wg-m249`](https://github.com/advisories/GHSA-g3hv-75wg-m249):
   minimatch globparts amplification can cause denial of service.
   Affected range: `>=7.0.0 <11.0.1`. First fixed version: **11.0.1**.

Ranges above are the registry audit results at review time, not an assertion
that every older major has been exhaustively reviewed.

## Affected installed packages

All 24 are in the **production dependency graph**; none is confined to this
project's TypeScript or Node-types development dependencies.
The final `npm audit --omit=dev --json` independently reported the same 24
moderate findings, confirming that omitting development dependencies does not
remove them.

| Package | Affected installed version(s) |
| --- | --- |
| `@npmcli/arborist` | 9.4.0 |
| `@npmcli/config` | 10.8.1 |
| `@npmcli/map-workspaces` | 5.0.3 |
| `@npmcli/metavuln-calculator` | 9.0.3 |
| `@npmcli/package-json` | 7.0.5 |
| `@npmcli/run-script` | 10.0.4 |
| `@opencode/plugin` | 2.3.2 |
| `@opencode/util` | 2.3.2 |
| `@sigstore/sign` | 4.1.1 |
| `@sigstore/tuf` | 4.0.2 |
| `@tufjs/models` | 4.1.0 |
| `cacache` | 20.0.4 |
| `gaxios` | 7.1.3 (nested under gcp-metadata; root 7.3.1 is not flagged) |
| `gcp-metadata` | 8.1.4 |
| `glob` | 13.0.5 and 10.5.0 |
| `ignore-walk` | 8.0.0 |
| `make-fetch-happen` | 15.0.6 |
| `minimatch` | 10.2.5 and 9.0.9 |
| `npm-packlist` | 10.0.4 |
| `npm-registry-fetch` | 19.1.1 |
| `pacote` | 21.5.1 |
| `rimraf` | 5.0.10 |
| `sigstore` | 4.1.1 |
| `tuf-js` | 4.1.0 |

Principal paths:

```text
@opencode/plugin@2.3.2
  -> @opencode/util@2.3.2
     -> glob@13.0.5 / minimatch@10.2.5
     -> npm/arborist/pacote/cache/sigstore/TUF dependencies
  -> @opencode/ai@2.3.2
     -> google-auth-library@10.5.0
        -> gcp-metadata@8.1.4
           -> gaxios@7.1.3 -> rimraf@5.0.10
              -> glob@10.5.0 -> minimatch@9.0.9
```

## Runtime exposure versus installation classification

The scanner's production classification must not be relabelled “development
only.” However, it also does not prove that the vulnerable functions execute
when opening viewers:

- Plugin pane management, title handling, ancestry checks, cleanup and viewer
  spawning do not call glob, minimatch, npm package resolution or Google auth.
- OpenCode supplies the plugin SDK in its TUI host. The separate viewer runner
  imports `@opencode/client` and its service API, not the AI/npm loader packages.
- The SDK's production dependency graph nevertheless installs these packages;
  OpenCode's own package discovery/install paths may exercise related utilities.
  This project audit does **not** audit the already-installed OpenCode executable
  or establish that all host-side paths are unreachable.
- Exploitability therefore depends on reaching the affected glob/cancellation
  or pattern-matching functions with adverse inputs. It is a resource-exhaustion
  risk, not evidence of arbitrary code execution in this plugin. No exploit was
  run against the user's service.

## Compatible fixes and decisions

`npm audit fix --dry-run --json` was run **without `--force`**. It proposes:

- Downgrade **gcp-metadata 8.1.4 -> 8.1.2**, within google-auth-library's `^8.0.0`
  constraint. 8.1.2 uses `gaxios: ^7.0.0`, which can reuse the already-installed
  7.3.1; 8.1.4 pins the affected 7.1.3. This removes the obsolete nested
  gaxios/rimraf/glob/minimatch branch (36 package removals in the dry run).
  This is a **compatible candidate**, not a major upgrade. It does not remove
  the util/npm findings. Because it is a downgrade with possible Google-auth
  behavioral implications outside the exercised viewer path, it was not
  justified for this release. It has not been applied.
- No automatic compatible fix is offered for the util/npm branch. Util 2.3.2
  pins glob **13.0.5** and minimatch **10.2.5** exactly. The verified fixed
  versions, glob **14.0.2** and minimatch **11.0.1**, cross those major/version
  constraints. Blanket npm overrides would bypass upstream compatibility
  guarantees; none was added.

Keep OpenCode and both direct API dependencies at **2.3.2** for this acceptance
run. No `npm audit fix --force`, forced overrides, SDK upgrade, or publication was
performed. An upstream compatible backport or a separately tested API upgrade is
needed to eliminate the remaining util/npm findings.

No compatible patched replacement within the pinned util constraints was found.
The proposed Google metadata change is a downgrade, not a verified upstream
security backport; forcing it merely to lower an audit count is not justified.
The reviewed npm lockfile preserves the inspected development tree. Consumer
installs can resolve compatible transitive dependencies differently because npm
does not apply this repository's lockfile when installing the release package;
audit the installed prefix as well. Counts and exposure can therefore change.

Evidence commands: `npm audit --json`, `npm explain glob`, `npm explain minimatch`,
`npm explain rimraf`, `npm explain gaxios`, non-forced audit-fix dry run, and
registry metadata for glob 14.0.2, minimatch 11.0.1, and gcp-metadata 8.1.2/8.1.4.
