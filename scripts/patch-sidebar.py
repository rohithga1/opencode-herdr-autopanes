"""Apply our explicit local cross-tab extension to a known companion checkout.

Usage: python3 scripts/patch-sidebar.py /path/to/herdr-sidebar-config
Backs up sidebar.py once. Refuses unknown source rather than guessing.
"""
from pathlib import Path
import shutil
import sys
import json

root = Path(sys.argv[1]).resolve()
path = root / "sidebar.py"
text = path.read_text()
edits = [
    ('from ordering import order_groups, apply_view',
     'from ordering import order_groups, apply_view\nfrom autopanes_groups import grouped, apply_group_view'),
    ('        desired = desired_rows(ordered_panes, workspaces, tabs, icon_mode(), activity.inactive_ids,',
     '        ordered_panes, cross_tab_groups = grouped(ordered_panes)\n'
     '        desired = desired_rows(ordered_panes, workspaces, tabs, icon_mode(), activity.inactive_ids,'),
    ('        for pane in panes:\n            desired[pane["pane_id"]]["hs_workspace_rank"]',
     '        for index, pane in enumerate(ordered_panes):\n'
     '            desired[pane["pane_id"]]["hs_autopanes_rank"] = f"{index:012d}" if pane.get("agent") else None\n'
     '        for pane in panes:\n            desired[pane["pane_id"]]["hs_workspace_rank"]'),
    ('        if clear or restore_view or read_state(view_path).get("order") != mode:\n'
     '            apply_view(mode)\n'
     '            view_path.write_text(json.dumps({"order": mode}), encoding="utf-8")',
     '        view_mode = mode + (":autopanes" if cross_tab_groups and not clear else "")\n'
     '        if clear or restore_view or read_state(view_path).get("order") != view_mode:\n'
     '            apply_group_view() if cross_tab_groups and not clear else apply_view(mode)\n'
     '            view_path.write_text(json.dumps({"order": view_mode}), encoding="utf-8")'),
]
if "from autopanes_groups import" not in text:
    for old, new in edits:
        if text.count(old) != 1:
            raise SystemExit("Unknown companion source; no files changed")
        text = text.replace(old, new)
    backup = root / "sidebar.py.before-autopanes"
    if backup.exists():
        raise SystemExit("Existing backup; inspect before patching")
    with backup.open("x") as stream:
        stream.write(path.read_text())
    backup.chmod(0o600)
    path.write_text(text)
shutil.copyfile(Path(__file__).resolve().parent.parent / "integrations/sidebar_groups.py", root / "autopanes_groups.py")
# Keep the companion's self-documentation test honest about this local fork.
checker = root / "tools/check_knowledge_docs.py"
check_text = checker.read_text()
if '"hs_autopanes_rank"' not in check_text:
    backup = checker.with_name(checker.name + ".before-autopanes")
    if not backup.exists():
        with backup.open("x") as stream:
            stream.write(check_text)
        backup.chmod(0o600)
    checker.write_text(check_text.replace('untwinned = {"hs_gap",', 'untwinned = {"hs_autopanes_rank", "hs_gap",'))
registry = root / "docs/knowledge/registry.json"
facts = json.loads(registry.read_text())
if not any(entry["path"] == "autopanes_groups.py" for entry in facts["modules"]):
    backup = registry.with_name(registry.name + ".before-autopanes")
    if not backup.exists():
        with backup.open("x") as stream:
            stream.write(registry.read_text())
        backup.chmod(0o600)
    facts["modules"].append({"path": "autopanes_groups.py", "role": "Local Autopanes cross-tab rendering extension",
                             "key_symbols": ["grouped", "apply_group_view"]})
    facts["tokens"].append({"name": "hs_autopanes_rank", "meaning": "Local cross-tab orchestrator display order",
                            "consumed_by": "view"})
    registry.write_text(json.dumps(facts, indent=2) + "\n")
print("Local companion extension installed; upstream license/notices left intact.")
