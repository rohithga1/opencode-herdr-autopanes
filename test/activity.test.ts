import assert from "node:assert/strict"
import { test } from "node:test"
import { activity } from "../src/activity.ts"

test("completion distinguishes turn-idle from background work and blocked descendants", async () => {
  const records: Record<string, object> = {
    a: { id: "a", outcome: "succeeded", time: { busy: 1, idle: 2 }, location: { directory: "/project" } },
    child: { id: "child", parentID: "a" },
    other: { id: "other" },
  }
  let active = {}
  let shells: object[] = []
  let requests: object[] = []
  const client = {
    session: { get: async ({ sessionID }: { sessionID: string }) => records[sessionID],
      active: async () => active },
    shell: { list: async () => ({ data: shells }) },
    permission: { request: { list: async () => ({ data: requests }) } },
    form: { list: async () => ({ data: [] }) },
  } as unknown as Parameters<typeof activity>[0]
  assert.equal(await activity(client, "a"), "done")
  shells = [{ status: "running", metadata: { sessionID: "child" } }]
  assert.equal(await activity(client, "a"), "working")
  shells = [{ status: "running", metadata: { sessionID: "other" } }]
  assert.equal(await activity(client, "a"), "done")
  active = { child: { type: "running" } }
  assert.equal(await activity(client, "a"), "working")
  requests = [{ sessionID: "child" }]
  assert.equal(await activity(client, "a"), "blocked")
  active = {}
  requests = []
  shells = [{ status: "running", metadata: {} }]
  assert.equal(await activity(client, "a"), "unknown")
  shells = []
  records.a = { id: "a", outcome: "failed", time: { busy: 1, idle: 2 }, location: { directory: "/project" } }
  assert.equal(await activity(client, "a"), "failed")
})
