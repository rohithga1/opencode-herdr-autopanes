import type { Plugin } from "@opencode/plugin/tui"

// A model turn can be "succeeded" while native background shells or descendants
// still run. Never infer agent completion from execution.succeeded alone.
export async function activity(client: Plugin.Context["client"], sessionID: string) {
  const options = { signal: AbortSignal.timeout(5000) }
  const session = await client.session.get({ sessionID }, options)
  const location = { directory: session.location.directory }
  const [active, shells, permissions, forms] = await Promise.all([
    client.session.active(options), client.shell.list({ location }, options),
    client.permission.request.list({ location }, options), client.form.list({ location }, options),
  ])
  const cache = new Map([[sessionID, session]])
  const within = async (id: string) => {
    const seen = new Set<string>()
    while (id && !seen.has(id)) {
      if (id === sessionID) return true
      seen.add(id)
      const value = cache.get(id) ?? await client.session.get({ sessionID: id }, options)
      cache.set(id, value)
      id = value.parentID ?? ""
    }
    return false
  }
  for (const request of [...permissions.data, ...forms.data]) {
    if (await within(request.sessionID)) return "blocked"
  }
  for (const id of Object.keys(active)) if (await within(id)) return "working"
  for (const shell of shells.data) {
    if (shell.status !== "running") continue
    const id = shell.metadata.sessionID
    // ponytail: unidentified running shells conservatively retain viewers at
    // this location; require reliable shell attribution before relaxing this.
    if (typeof id !== "string") return "unknown"
    if (await within(id)) return "working"
  }
  if (!session.outcome || !session.time.idle || session.time.idle < (session.time.busy ?? 0)) return "unknown"
  return session.outcome === "failed" ? "failed" : "done"
}
