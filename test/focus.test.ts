import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer, type Socket } from "node:net"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { FocusGuard } from "../src/focus.ts"

test("focus guard protects current inspection, separates explicit pins, and fails closed on unavailable observation", async () => {
  const dir = await mkdtemp("/tmp/opencode/focus-test-")
  const path = join(dir, "socket")
  let peer: Socket | undefined
  const server = createServer((socket) => {
    peer = socket
    socket.once("data", (data) => {
      assert.equal(JSON.parse(data.toString()).method, "events.subscribe")
      socket.write('{"result":{"type":"subscription_started"}}\n')
    })
  })
  await new Promise<void>((resolve) => server.listen(path, resolve))
  const reports: string[] = []
  const guard = new FocusGuard(path, (message) => reports.push(message))
  const settle = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i++) await new Promise<void>((r) => setImmediate(r))
    assert.ok(check())
  }
  try {
    assert.equal(guard.canClose("pane"), "inspection unavailable")
    await settle(() => guard.canClose("pane") === true)
    guard.pin("preexisting")
    assert.equal(guard.canClose("preexisting"), "explicitly pinned")
    peer!.write('{"event":"pane_focused","data":{"pane_id":"pane"}}\n')
    await settle(() => guard.canClose("pane") === "currently inspected")
    // Returning focus to another pane releases automatic inspection protection.
    peer!.write('{"event":"pane_focused","data":{"pane_id":"other"}}\n')
    await settle(() => guard.canClose("other") === "currently inspected")
    assert.equal(guard.canClose("pane"), true)
    guard.unpin("preexisting")
    assert.equal(guard.canClose("preexisting"), true)
    peer!.destroy()
    await settle(() => reports.length > 0)
    assert.equal(guard.canClose("never-inspected"), "inspection unavailable")
  } finally {
    guard.dispose()
    peer?.destroy()
    await new Promise<void>((r) => server.close(() => r()))
    await rm(dir, { recursive: true, force: true })
  }
})
