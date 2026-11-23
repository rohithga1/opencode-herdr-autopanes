import { createConnection } from "node:net"

// Herdr's snapshot has one global focus, not every attached client's viewport.
// Any focus event pins that pane for its lifetime. Fail closed if events are
// unavailable; do not guess that a viewer is uninspected after reconnect/reload.
export class FocusGuard {
  private ready = false
  private pinned = new Set<string>()
  private socket
  constructor(path: string, report: (message: string) => void) {
    this.socket = createConnection(path)
    let buffer = ""
    this.socket.setEncoding("utf8")
    this.socket.on("connect", () => this.socket.write(JSON.stringify({
      id: "autopanes-focus", method: "events.subscribe",
      params: { subscriptions: [{ type: "pane.focused" }, { type: "pane.closed" }] },
    }) + "\n"))
    this.socket.on("data", (data) => {
      buffer += data
      if (buffer.length > 1024 * 1024) { this.socket.destroy(); return }
      let index
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1)
        try {
          const event = JSON.parse(line)
          if (event.result?.type === "subscription_started") this.ready = true
          if (event.event === "pane_focused") this.pinned.add(event.data.pane_id)
          if (event.event === "pane_closed") this.pinned.delete(event.data.pane_id)
          if (event.error) this.socket.destroy()
        } catch { this.socket.destroy() }
      }
    })
    this.socket.on("error", () => {})
    this.socket.on("close", () => {
      this.ready = false
      report("Herdr focus stream unavailable; automatic viewer closing disabled. Manual cleanup still works.")
    })
  }
  protect(id: string) { this.pinned.add(id) }
  canClose(id: string) { return this.ready && !this.pinned.has(id) }
  dispose() {
    this.ready = false
    this.socket.removeAllListeners("close")
    this.socket.destroy()
  }
}
