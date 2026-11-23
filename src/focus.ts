import { createConnection } from "node:net"

export type CloseBlockReason = "currently inspected" | "explicitly pinned" | "inspection unavailable"

// Herdr exposes the current focused pane, not a durable "was ever inspected"
// flag. Automatic inspection protection follows focus changes; it must not turn
// a completed viewer into a permanent manual-close exclusion.
export class FocusGuard {
  private ready = false
  private focused?: string
  private explicitPins = new Set<string>()
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
          if (event.event === "pane_focused") this.focused = event.data.pane_id
          if (event.event === "pane_closed") {
            if (this.focused === event.data.pane_id) this.focused = undefined
            this.explicitPins.delete(event.data.pane_id)
          }
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
  pin(id: string) { this.explicitPins.add(id) }
  unpin(id: string) { this.explicitPins.delete(id) }
  canClose(id: string): true | CloseBlockReason {
    if (!this.ready) return "inspection unavailable"
    if (this.explicitPins.has(id)) return "explicitly pinned"
    if (this.focused === id) return "currently inspected"
    return true
  }
  dispose() {
    this.ready = false
    this.socket.removeAllListeners("close")
    this.socket.destroy()
  }
}
