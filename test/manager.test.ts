import assert from "node:assert/strict"
import { test } from "node:test"
import { execFileSync } from "node:child_process"
import { Manager, enabled, newState, type Pane, type Session } from "../src/manager.ts"
import { quote } from "../src/herdr.ts"

function harness(max = 4) {
  const state = newState()
  state.owner = "root"
  const sessions = new Map<string, Session>()
  for (const [id, parentID] of [
    ["root", undefined], ["a", "root"], ["b", "root"], ["nested", "a"],
    ["other", undefined], ["outsider", "other"], ["cycle", "cycle"],
  ]) sessions.set(id!, { id: id!, parentID, location: { directory: "/project" } })
  let panes: Pane[] = []
  const launches: string[] = []
  const reports: string[] = []
  let fail = false
  let active = 0
  let peak = 0
  const io = {
    prefix: "ocap:owner:",
    max,
    get: async (id: string) => {
      const session = sessions.get(id)
      if (!session) throw new Error("missing session")
      return session
    },
    list: async () => panes,
    launch: async (session: Session, label: string) => {
      peak = Math.max(peak, ++active)
      await new Promise<void>((resolve) => setImmediate(resolve))
      active--
      if (fail) throw new Error("launch failed")
      launches.push(session.id)
      panes.push({ pane_id: `pane-${session.id}`, label })
    },
    close: async (id: string) => { panes = panes.filter((p) => p.pane_id !== id) },
    report: (message: string) => { reports.push(message) },
  }
  const manager = new Manager(state, io)
  return { state, io, manager, sessions, launches, reports, panes: () => panes,
    closeAll: () => { panes = [] }, setFail: (value: boolean) => { fail = value }, peak: () => peak }
}

test("only direct/deep descendants; unrelated, owner and cyclic sessions excluded", async () => {
  const h = harness()
  await Promise.all(["root", "a", "nested", "outsider", "other", "cycle"].map((id) => h.manager.consider(id)))
  assert.deepEqual(h.launches, ["a", "nested"])
})

test("concurrent duplicates deduplicate by identity and serialize layout", async () => {
  const h = harness()
  await Promise.all(Array.from({ length: 30 }, (_, i) => h.manager.consider(i % 2 ? "a" : "b")))
  assert.deepEqual(h.launches, ["b", "a"])
  assert.equal(h.peak(), 1)
})

test("retained panes count, overflow reports without stopping work", async () => {
  const h = harness(1)
  await h.manager.consider("a")
  await h.manager.consider("b")
  assert.deepEqual(h.launches, ["a"])
  assert.match(h.reports[0]!, /pane limit 1.*Agent continues normally/)
  h.closeAll()
  await h.manager.retry(["b"])
  assert.deepEqual(h.launches, ["a", "b"])
})

test("manual close does not cause automatic reopen", async () => {
  const h = harness()
  await h.manager.consider("a")
  h.closeAll()
  await h.manager.consider("a")
  assert.equal(h.launches.length, 1)
  await h.manager.consider("b")
  assert.equal(h.panes().length, 1)
})

test("targeted recovery reopens only the requested closed viewer", async () => {
  const h = harness()
  await h.manager.consider("a")
  await h.manager.consider("b")
  await h.io.close("pane-a")
  await h.manager.retry(["a"])
  assert.deepEqual(h.launches, ["a", "b", "a"])
  assert.equal(h.state.seen.has("b"), true)
  assert.equal(h.panes().filter((p) => p.pane_id === "pane-b").length, 1)
})

test("mismatched server session identity is refused", async () => {
  const h = harness()
  h.sessions.set("a", { id: "b", parentID: "root", location: { directory: "/project" } })
  await h.manager.consider("a")
  assert.deepEqual(h.launches, [])
  assert.match(h.reports[0]!, /identity mismatch/)
})

test("titles have terminal controls removed and remain data, not shell commands", async () => {
  const h = harness()
  h.sessions.get("a")!.title = "\x1b\u009b$(echo not-executed) 'title'"
  await h.manager.consider("a")
  assert.match(h.panes()[0]!.label!, /\$\(echo not-executed\)/)
  assert.doesNotMatch(h.panes()[0]!.label!, /[\x00-\x1f\x7f-\x9f]/)
})
test("launch and lookup failures are contained; explicit retry works", async () => {
  const h = harness()
  h.setFail(true)
  await Promise.all([h.manager.consider("a"), h.manager.consider("a"), h.manager.consider("missing")])
  assert.equal(h.reports.length, 2)
  h.setFail(false)
  await h.manager.retry(["a"])
  assert.deepEqual(h.launches, ["a"])
})

test("missing Herdr discovery is reported only once for concurrent duplicate events", async () => {
  const h = harness()
  h.io.list = async () => { throw new Error("Herdr unavailable") }
  await Promise.all(Array.from({ length: 20 }, () => h.manager.consider("a")))
  assert.equal(h.reports.length, 1)
  assert.deepEqual(h.launches, [])
})

test("reload generations share queue and claims; disposed queued work does not launch", async () => {
  const h = harness()
  const one = h.manager.consider("a")
  await one
  h.manager.dispose()
  const next = new Manager(h.state, h.io)
  await Promise.all([h.manager.consider("b"), next.consider("a"), next.consider("b")])
  assert.deepEqual(h.launches, ["a", "b"])
  assert.equal(h.peak(), 1)
})

test("retained labels deduplicate after a fresh TUI state", async () => {
  const h = harness()
  await h.manager.consider("a")
  const fresh = newState()
  fresh.owner = "root"
  await new Manager(fresh, h.io).consider("a")
  assert.equal(h.launches.length, 1)
})

test("cleanup closes only this context's owned panes, preserves seen claims", async () => {
  const h = harness()
  h.panes().push({ pane_id: "user", label: "user" }, { pane_id: "other", label: "ocap:other:a other" })
  await h.manager.consider("a")
  await h.manager.cleanup()
  assert.deepEqual(h.panes().map((p) => p.pane_id), ["user", "other"])
  assert.match(h.reports.at(-1)!, /keep running/)
  await h.manager.consider("a")
  assert.equal(h.launches.length, 1)
})

test("viewer marker prevents recursion; missing Herdr context stays inert", () => {
  const env = { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1", HERDR_SOCKET_PATH: "/socket" }
  assert.equal(enabled(env), true)
  assert.equal(enabled({ ...env, OPENCODE_HERDR_VIEWER: "1" }), false)
  assert.equal(enabled({}), false)
  assert.equal(enabled({ ...env, HERDR_SOCKET_PATH: "" }), false)
})

test("POSIX shell construction round-trips metacharacters without evaluation", () => {
  const input = "a 'quote'\n$(echo should-not-run); `id` \" $HOME"
  const output = execFileSync("/bin/sh", ["-c", `printf '%s' ${quote(input)}`], { encoding: "utf8" })
  assert.equal(output, input)
})
