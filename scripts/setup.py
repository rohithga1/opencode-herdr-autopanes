#!/usr/bin/env python3
"""Install both release components inside the intended Herdr terminal."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent
COMPANION = ROOT / "companion"
sys.path.insert(0, str(COMPANION))
import setup_sidebar as sidebar
import host

VERSION = json.loads((ROOT / "package.json").read_text())["version"]


def regular(path):
    """Reject symlinks in writable paths, including parent directories."""
    for part in (path, *path.parents):
        if part.is_symlink():
            raise RuntimeError(f"Symlink-managed path requires manual setup: {part}")
    if path.exists() and not path.is_file():
        raise RuntimeError(f"Expected a regular file: {path}")


def read(path):
    regular(path)
    return path.read_bytes() if path.exists() else None


def write(path, data):
    regular(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def config(raw):
    result = json.loads(raw) if raw else {}
    if not isinstance(result, dict) or not isinstance(result.get("plugins", []), list):
        raise RuntimeError("cli.json must be an object with a plugins array.")
    return result


def package(entry):
    return entry if isinstance(entry, str) else entry.get("package") if isinstance(entry, dict) else None


def is_autopanes(entry):
    value = package(entry)
    if not isinstance(value, str):
        return False
    if value == "opencode-herdr-autopanes" or value.startswith("opencode-herdr-autopanes@"):
        return True
    if value.startswith("/") or value.startswith("file://"):
        from urllib.parse import unquote, urlparse
        path = Path(unquote(urlparse(value).path) if value.startswith("file://") else value)
        try:
            return json.loads((path / "package.json").read_text()).get("name") == "opencode-herdr-autopanes"
        except (OSError, ValueError):
            return False
    return False


def verify_companion(root):
    manifest = json.loads((COMPANION / "FILES.json").read_text())
    for name, expected in manifest.items():
        path = root / name
        regular(path)
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise RuntimeError(f"Companion differs from the pinned extension: {name}")
    # Extra executable code could add reporters even if pinned files match.
    for path in root.rglob("*"):
        if path.is_file() and path.suffix in {".py", ".sh", ".cmd", ".toml"}:
            if str(path.relative_to(root)) not in manifest:
                raise RuntimeError(f"Customized companion source: {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["install", "doctor", "uninstall", "rollback"])
    parser.add_argument("--upgrade-from", type=Path, help="exact old package directory; keep it for rollback")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if sys.version_info < (3, 11) or sys.platform != "linux":
        raise RuntimeError("This release setup supports Linux with Python 3.11+.")
    if os.environ.get("HERDR_ENV") != "1":
        raise RuntimeError("Run inside the intended Herdr terminal.")
    verify_companion(COMPANION)
    binary = sidebar.herdr_binary()
    snapshot = sidebar.run_herdr(binary, "api", "snapshot")["result"]["snapshot"]
    if snapshot.get("version") != "0.9.5":
        raise RuntimeError("This experimental setup is verified only with Herdr 0.9.5.")
    cli = Path(os.environ.get("OPENCODE_CONFIG_DIR") or
               str(Path(os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config"))) / "opencode")) / "cli.json"
    cli = cli.absolute()
    journal = cli.parent / f"herdr-autopanes-{VERSION}.json"
    original = read(cli)
    current = config(original)
    prior = read(journal)
    state = json.loads(prior) if prior else None
    info = sidebar.plugin_info(binary)
    plugins = sidebar.run_herdr(binary, "plugin", "list", "--json")["result"]["plugins"]
    for plugin in plugins:
        if plugin["plugin_id"] == sidebar.PLUGIN_ID or not plugin["enabled"]:
            continue
        root = Path(plugin["plugin_root"])
        for path in root.rglob("*"):
            if path.is_file() and path.suffix in {".py", ".sh", ".js", ".ts", ".toml"}:
                if b"agent.view.set" in path.read_bytes():
                    raise RuntimeError(f"Conflicting sidebar override reporter: {plugin['plugin_id']}. Disable it before setup.")
    herdr_config = sidebar.default_config().absolute()
    regular(herdr_config)
    preferences = sidebar.plugin_config_dir(binary) / "config.toml"
    regular(preferences)
    companion_state = herdr_config.parent / f"herdr-autopanes-{VERSION}"
    regular(companion_state / "install.json")
    if state and (state["package"] != str(ROOT) or state["herdr_config"] != str(herdr_config)):
        raise RuntimeError("An installation record belongs to another package/configuration. Use that installation's setup.")
    if info:
        installed = Path(info["plugin_root"]).absolute()
        try:
            verify_companion(installed)
        except (OSError, ValueError, RuntimeError) as error:
            raise RuntimeError("Existing sidebar is incompatible or customized; nothing overwritten. "
                               "Keep its checkout/backups. Use its own uninstall/disable flow, then "
                               "herdr plugin unlink testy-cool.herdr-sidebar, before retrying. " + str(error))
    else:
        installed = COMPANION
    owned = state["companion_owned"] if state else not bool(info)
    opts = argparse.Namespace(config=herdr_config, state_dir=companion_state, text=True,
                             font_dir=host.font_dir(), ghostty_config=host.ghostty_config(),
                             dry_run=args.dry_run, json=True)

    if args.command in {"uninstall", "rollback"}:
        if not state:
            raise RuntimeError("No owned installation journal; nothing removed.")
        if args.command == "rollback" and not state["previous"]:
            raise RuntimeError("No previous registration to restore; use uninstall.")
        entries = current.get("plugins", [])
        matches = [e for e in entries if package(e) == str(ROOT)]
        if args.command == "rollback" and matches and matches != [state["entry"]]:
            raise RuntimeError("Plugin options changed after setup; preserve/reconcile them before rollback.")
        restored = [e for e in entries if package(e) != str(ROOT)]
        if args.command == "rollback":
            for index, entry in state["previous"]:
                if entry not in restored:
                    restored.insert(min(index, len(restored)), entry)
        current["plugins"] = restored
        if owned and (companion_state / "install.json").exists():
            # Preflight before disabling anything; later edits to owned tables stop removal.
            sidebar.restorations(json.loads(read(companion_state / "install.json")), herdr_config)
        if args.dry_run:
            print("Would remove only this package registration and owned sidebar changes; retain files, preferences and backups.")
            return
        if owned and (companion_state / "install.json").exists():
            sidebar.uninstall(opts, binary)
        if owned and info:
            sidebar.run_herdr(binary, "plugin", "unlink", sidebar.PLUGIN_ID)
        if read(cli) != original:
            raise RuntimeError("cli.json changed during setup; retry after settings edits finish.")
        write(cli, (json.dumps(current, indent=2) + "\n").encode())
        journal.rename(journal.with_name(f"{journal.stem}.removed-{time.time_ns()}.json"))
        print("Removed owned registration. Package files, user preferences and private backups retained.")
        return

    if args.command == "doctor":
        if not info or not any(package(e) == str(ROOT) for e in current.get("plugins", [])):
            raise RuntimeError("Both component registrations are required.")
        if sidebar.doctor(opts, binary):
            raise RuntimeError("Companion doctor needs attention.")
        print("Both registrations and pinned companion verified; use live agents to verify navigation.")
        return

    entries = current.get("plugins", [])
    old = [(i, e) for i, e in enumerate(entries) if is_autopanes(e) and package(e) != str(ROOT)]
    if old:
        if not args.upgrade_from or len(old) != 1 or package(old[0][1]) != str(args.upgrade_from.absolute()):
            raise RuntimeError("Existing Autopanes registration found. Supply --upgrade-from with its exact absolute package path; no duplicates added.")
        old_meta = json.loads((args.upgrade_from / "package.json").read_text())
        def version(value):
            try:
                return tuple(int(part) for part in value.split("."))
            except (AttributeError, ValueError):
                return ()
        if not version(old_meta.get("version")) or version(old_meta["version"]) >= version(VERSION):
            raise RuntimeError(f"--upgrade-from must name an older released package than v{VERSION}.")
    elif args.upgrade_from and not state:
        raise RuntimeError("--upgrade-from does not match an existing registration.")
    same = [e for e in entries if package(e) == str(ROOT)]
    if len(same) > 1:
        raise RuntimeError("Duplicate package entries; reconcile them before installing.")
    entry = same[0] if same else {"package": str(ROOT), "options": {
        **(old[0][1].get("options", {}) if old and isinstance(old[0][1], dict) else {}),
        "mode": "tabs", "maxPanes": 4, "closeOnCompletion": False, "closeDelaySeconds": 60,
    }}
    if not same:
        current["plugins"] = [e for e in entries if not is_autopanes(e)] + [entry]
    if info and not owned:
        # Reuse only a configured, enabled, byte-verified installation; do not take ownership.
        if not info["enabled"] or sidebar.doctor(opts, binary):
            raise RuntimeError("Existing compatible companion is not ready; repair it with its own setup first.")
        import tomllib
        if tomllib.loads((read(preferences) or b"").decode()).get("icons") != "text":
            raise RuntimeError("Existing companion must explicitly use text icons; change its settings before reuse.")
    print("Setup: grouped agent rows, workspace-name dimming, sidebar sort, unclaimed settings shortcut; text labels, no fonts.")
    if owned and (companion_state / "install.json").exists():
        sidebar.restorations(json.loads(read(companion_state / "install.json")), herdr_config)
    if args.dry_run:
        if owned:
            sidebar.install(opts, binary)
        print(f"Would register {ROOT} in {cli}; backups: {journal.parent}")
        return
    if not state:
        backup = cli.with_name(f"cli.json.before-autopanes-{VERSION}-{time.time_ns()}.bak")
        if original is not None:
            write(backup, original)
        state = {"package": str(ROOT), "herdr_config": str(herdr_config), "companion_owned": owned,
                 "entry": entry, "previous": old, "cli_backup": str(backup) if original else None}
        write(journal, (json.dumps(state, indent=2) + "\n").encode())
    if owned:
        sidebar.install(opts, binary)
    if read(cli) != original:
        raise RuntimeError("cli.json changed during setup; retry after settings edits finish. Backup/journal retained.")
    write(cli, (json.dumps(current, indent=2) + "\n").encode())
    print("Installed both components. CLI settings reload live; no service restart. Run setup.py doctor.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"Setup stopped: {error}", file=sys.stderr)
        sys.exit(1)
