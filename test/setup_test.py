"""Run: python3 -m unittest discover -s test -p '*_test.py'."""
import importlib.util
import json
import os
import shutil
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("release_setup", Path(__file__).resolve().parents[1] / "scripts/setup.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class SetupTest(unittest.TestCase):
    def test_install_upgrade_rollback_and_later_edits(self):
        with tempfile.TemporaryDirectory(prefix="autopanes-setup-") as directory:
            root = Path(directory)
            cli = root / "opencode/cli.json"
            old = root / "old package ' quoted"
            old.mkdir()
            (old / "package.json").write_text(json.dumps({"name": "opencode-herdr-autopanes", "version": "0.1.0"}))
            original = {"theme": "custom", "plugins": ["unrelated", {"package": str(old), "options": {"maxPanes": 2}}]}
            setup.write(cli, json.dumps(original).encode())
            def herdr(binary, *args):
                if args[:2] == ("api", "snapshot"):
                    return {"result": {"snapshot": {"version": "0.9.5"}}}
                return {"result": {"plugins": []}}
            env = {"HERDR_ENV": "1", "OPENCODE_CONFIG_DIR": str(cli.parent), "HERDR_CONFIG_PATH": str(root / "herdr/config.toml")}
            with patch.dict(os.environ, env), patch.object(setup.sidebar, "herdr_binary", return_value="herdr"), \
                 patch.object(setup.sidebar, "run_herdr", side_effect=herdr), \
                 patch.object(setup.sidebar, "plugin_info", return_value=None), \
                 patch.object(setup.sidebar, "plugin_config_dir", return_value=root / "prefs"), \
                 patch.object(setup.sidebar, "install") as install:
                with patch("sys.argv", ["setup.py", "install"]):
                    with self.assertRaisesRegex(RuntimeError, "upgrade-from"):
                        setup.main()
                self.assertEqual(json.loads(cli.read_bytes()), original)
                with patch("sys.argv", ["setup.py", "install", "--upgrade-from", str(old)]):
                    setup.main()
                self.assertEqual(install.call_count, 1)
                cfg = json.loads(cli.read_bytes())
                self.assertEqual(cfg["plugins"][0], "unrelated")
                self.assertEqual(cfg["plugins"][1]["options"]["mode"], "tabs")
                cfg["theme"] = "later edit"
                cfg["plugins"].append("added-later")
                setup.write(cli, json.dumps(cfg).encode())
                with patch("sys.argv", ["setup.py", "rollback"]):
                    setup.main()
                restored = json.loads(cli.read_bytes())
                self.assertEqual(restored["theme"], "later edit")
                self.assertEqual(restored["plugins"], [*original["plugins"], "added-later"])

    def test_path_and_snapshot_guards(self):
        setup.verify_companion(setup.COMPANION)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "target"
            target.write_text("preserve")
            link = root / "link"
            link.symlink_to(target)
            with self.assertRaises(RuntimeError):
                setup.write(link, b"overwrite")
            self.assertEqual(target.read_text(), "preserve")
            with self.assertRaises(RuntimeError):
                setup.config(b"[]")

    def test_managed_sidebar_edits_are_not_overwritten(self):
        import base64
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.toml"
            before = '[theme]\nname = "custom"\n'
            fragment = (setup.COMPANION / "sidebar-layout.toml").read_text()
            installed = setup.sidebar.settings_binding(setup.sidebar.merge_layout(before, fragment))
            path.write_text(installed.replace('agent_panel_sort = "spaces"', 'agent_panel_sort = "activity"'))
            state = {"files": {str(path): {"before": base64.b64encode(before.encode()).decode()}}}
            with self.assertRaisesRegex(RuntimeError, "customized"):
                setup.sidebar.restorations(state, path)
            self.assertIn('"activity"', path.read_text())

    def test_customized_companion_is_refused_without_configuration_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            customized = root / "custom companion"
            shutil.copytree(setup.COMPANION, customized, ignore=shutil.ignore_patterns("__pycache__"))
            source = customized / "autopanes_groups.py"
            source.write_text(source.read_text() + "\n# user's customization\n")
            cli = root / "opencode/cli.json"
            setup.write(cli, b'{"theme":"keep","plugins":["unrelated"]}')
            before = cli.read_bytes()
            def herdr(binary, *args):
                return {"result": {"snapshot": {"version": "0.9.5"}}} if args[0] == "api" else {"result": {"plugins": []}}
            with patch.dict(os.environ, {"HERDR_ENV": "1", "OPENCODE_CONFIG_DIR": str(cli.parent),
                                         "HERDR_CONFIG_PATH": str(root / "herdr/config.toml")}), \
                 patch("sys.argv", ["setup.py", "install"]), \
                 patch.object(setup.sidebar, "herdr_binary", return_value="herdr"), \
                 patch.object(setup.sidebar, "run_herdr", side_effect=herdr), \
                 patch.object(setup.sidebar, "plugin_info", return_value={"plugin_root": str(customized), "enabled": True}), \
                 patch.object(setup.sidebar, "plugin_config_dir", return_value=root / "prefs"):
                with self.assertRaisesRegex(RuntimeError, "customized"):
                    setup.main()
            self.assertEqual(cli.read_bytes(), before)
            self.assertIn("user's customization", source.read_text())
            self.assertFalse((cli.parent / "herdr-autopanes-0.2.0.json").exists())


if __name__ == "__main__":
    unittest.main()
