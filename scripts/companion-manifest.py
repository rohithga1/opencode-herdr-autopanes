"""Maintainer-only: record the exact bundled companion files after review."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "companion"
files = {}
for path in sorted(root.rglob("*")):
    if not path.is_file() or "__pycache__" in path.parts or path.name in {"FILES.json", ".npmignore"}:
        continue
    files[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
(root / "FILES.json").write_text(json.dumps(files, indent=2) + "\n")
