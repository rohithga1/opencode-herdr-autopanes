import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtemp, readFile, writeFile, rm, chmod, stat } from "node:fs/promises"
import { join } from "node:path"
import { Herdr } from "../src/herdr.ts"

test("Herdr argv, private auth file, failed run cleanup and late startup", async () => {
  const dir = await mkdtemp("/tmp/opencode/autopanes-test-")
  const original = { ...process.env }
  const pending = new Map<string, number>()
  const reports: string[] = []
  try {
    const binary = join(dir, "herdr")
    await writeFile(binary, `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(join(dir, "calls"))}, JSON.stringify(args)+'\\n');
if(args[1]==='run' && process.env.FAIL_RUN==='1') process.exit(1);
if(['run','close'].includes(args[1])) process.exit(0);
console.log(JSON.stringify({result: args[1]==='list' ? {panes:[]} : {pane:{pane_id:'w1:p2'}}}));
`)
    await chmod(binary, 0o700)
    Object.assign(process.env, {
      PATH: `${dir}:${original.PATH}`, HERDR_SOCKET_PATH: "/caller/socket",
      HERDR_PANE_ID: "w1:p1", HERDR_WORKSPACE_ID: "w1",
    })
    const session = { id: "ses_actual", title: "subagent", location: { directory: "/project with 'quotes'" } }
    const endpoint = { url: "http://localhost:4096", auth: { type: "basic" as const, username: "opencode", password: "secret-not-in-argv" } }
    const h = new Herdr((m) => reports.push(m), pending)
    await h.launch(session, "ocap:owner:ses_actual subagent", endpoint)
    const calls = (await readFile(join(dir, "calls"), "utf8")).trim().split("\n").map((s) => JSON.parse(s) as string[])
    assert.deepEqual(calls[0], ["pane", "split", "--pane", "w1:p1", "--direction", "right",
      "--cwd", session.location.directory, "--env", "OPENCODE_HERDR_VIEWER=1", "--no-focus"])
    assert.deepEqual(calls[1], ["pane", "rename", "w1:p2", "ocap:owner:ses_actual subagent"])
    assert.equal(calls[2]![1], "run")
    assert.equal(JSON.stringify(calls).includes(endpoint.auth.password), false)
    const launchDir = [...pending.keys()][0]!
    assert.equal((await stat(launchDir)).mode & 0o777, 0o700)
    assert.equal((await stat(join(launchDir, "launch.json"))).mode & 0o777, 0o600)
    const config = JSON.parse(await readFile(join(launchDir, "launch.json"), "utf8"))
    assert.equal(config.executable, process.execPath)
    assert.deepEqual(config.args, ["--server", endpoint.url, "--session", session.id, session.location.directory])
    assert.equal(config.env.OPENCODE_HERDR_VIEWER, "1")
    assert.equal(config.env.OPENCODE_PASSWORD, endpoint.auth.password)
    pending.set(launchDir, Date.now() - 31000)
    await h.check()
    assert.equal(pending.size, 0)
    assert.match(reports[0]!, /did not acknowledge startup/)
    process.env.FAIL_RUN = "1"
    const failed = new Herdr((m) => reports.push(m), pending)
    await assert.rejects(failed.launch(session, "ocap:owner:ses_actual subagent", endpoint), /Herdr pane run failed/)
    assert.equal(pending.size, 0)
    const all = await readFile(join(dir, "calls"), "utf8")
    assert.ok(all.includes('["pane","close","w1:p2"]'))
    process.env.PATH = dir + "/missing"
    await assert.rejects(new Herdr(() => {}).list(), /Herdr pane list failed/)
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]
    Object.assign(process.env, original)
    for (const path of pending.keys()) await rm(path, { recursive: true, force: true })
    await rm(dir, { recursive: true, force: true })
  }
})
