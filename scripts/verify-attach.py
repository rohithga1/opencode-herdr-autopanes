"""Live OpenCode 2.3.2 attach check; never creates/prompts sessions or controls Herdr.

Usage: python3 scripts/verify-attach.py <completed-session-id> [<another-id>]
Requires the repository's npm dependencies and an existing compatible service.
"""
import concurrent.futures
import fcntl
import json
import os
import pathlib
import pty
import select
import signal
import struct
import subprocess
import sys
import termios
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
IDS = sys.argv[1:]
if not IDS:
    raise SystemExit("Supply existing completed session IDs; this check creates no sessions.")

# Keep credentials in memory, never print or save them.
probe = """
import { Service } from '@opencode/client/service';
import { OpenCode } from '@opencode/client';
const endpoint = await Service.discover({version:'2.3.2'});
if (!endpoint) throw Error('No compatible service');
const c = OpenCode.make({baseUrl:endpoint.url, headers:Service.headers(endpoint)});
const sessions = await Promise.all(process.argv.slice(1).map(async sessionID => {
  const s = await c.session.get({sessionID});
  const messages = await c.session.context({sessionID});
  return {...s, messageIDs:messages.map(m=>m.id)};
}));
if (sessions.some(s => s.time.busy && (!s.time.idle || s.time.busy > s.time.idle))) throw Error('Use completed sessions');
console.log(JSON.stringify({endpoint,sessions}));
"""
data = json.loads(subprocess.check_output(
    ["node", "--input-type=module", "-e", probe, *IDS], cwd=ROOT, text=True))


def attach(session):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 48, 180, 0, 0))
    env = {**os.environ, "TERM": "xterm-256color", "OPENCODE_LOG_LEVEL": "DEBUG"}
    # Outside Herdr is intentional: this check must not touch user layout.
    for key in list(env):
        if key.startswith("HERDR_"):
            del env[key]
    private = tempfile.TemporaryDirectory(prefix="autopanes-live-", dir="/tmp/opencode")
    config = pathlib.Path(private.name) / "launch.json"
    payload = {
        "executable": "opencode",
        "args": ["--server", data["endpoint"]["url"], "--session", session["id"], session["location"]["directory"]],
        "env": {"OPENCODE_HERDR_VIEWER": "1"},
        "endpoint": data["endpoint"], "sessionID": session["id"],
        "status": str(pathlib.Path(private.name) / "status.json"),
    }
    if data["endpoint"].get("auth"):
        payload["env"]["OPENCODE_PASSWORD"] = data["endpoint"]["auth"]["password"]
    config.touch(mode=0o600)
    config.write_text(json.dumps(payload))
    process = subprocess.Popen(
        ["node", str(ROOT / "src/viewer.mjs"), str(config)],
        stdin=slave, stdout=slave, stderr=slave, env=env, start_new_session=True)
    os.close(slave)
    output = bytearray()
    deadline = time.monotonic() + 15
    try:
        while time.monotonic() < deadline and process.poll() is None:
            if select.select([master], [], [], 0.1)[0]:
                try:
                    chunk = os.read(master, 65536)
                except OSError:
                    break
                output.extend(chunk)
                if b"\x1b[6n" in chunk:
                    os.write(master, b"\x1b[1;1R")
    finally:
        # Only the explicitly spawned viewer process; never restart/stop the service.
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        os.close(master)
        private.cleanup()
    path = pathlib.Path("/tmp/opencode") / f"autopanes-attach-{session['id']}.ansi"
    path.touch(mode=0o600, exist_ok=True)
    path.write_bytes(output)
    text = output.decode(errors="replace")
    shown = session["id"] in text
    print(f"{session['id']}: session ID in rendered conversation {'PASS' if shown else 'NOT OBSERVED'}; transcript {path}")
    return shown


with concurrent.futures.ThreadPoolExecutor(max_workers=len(IDS)) as pool:
    results = list(pool.map(attach, data["sessions"]))
after = json.loads(subprocess.check_output(
    ["node", "--input-type=module", "-e", probe, *IDS], cwd=ROOT, text=True))
for before, current in zip(data["sessions"], after["sessions"]):
    if before["messageIDs"] != current["messageIDs"]:
        raise SystemExit(f"Conversation changed unexpectedly: {before['id']}")
print("Existing session message IDs unchanged; no prompts submitted.")
if not all(results):
    raise SystemExit("Inspect transcripts: use probe sessions whose response includes their own session ID.")
