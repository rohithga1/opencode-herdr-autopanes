export type Session = {
  id: string
  parentID?: string
  title?: string
  location: { directory: string; workspaceID?: string }
}
export type Pane = {
  pane_id: string; label?: string | null; focused?: boolean; agent_status?: string
  tokens?: Record<string, string>
}
export const owns = (pane: Pane, prefix: string) =>
  pane.tokens?.ocap_owner === prefix || pane.label?.startsWith(prefix) === true
export const paneSession = (pane: Pane, prefix: string) =>
  pane.tokens?.ocap_owner === prefix ? pane.tokens.ocap_session :
    pane.label?.startsWith(prefix) ? pane.label.slice(prefix.length).split(" ")[0] : undefined
// A class stays opaque in Solid storage; nested plain objects are readonly proxies.
export class State {
  tail = Promise.resolve()
  seen = new Set<string>()
  owner?: string
  pending = new Map<string, number>()
  completed = new Map<string, number>()
}
export const newState = () => new State()

export function enabled(env: NodeJS.ProcessEnv) {
  return env.HERDR_ENV === "1" && !!env.HERDR_SOCKET_PATH &&
    !!env.HERDR_PANE_ID && env.OPENCODE_HERDR_VIEWER !== "1"
}

export class Manager {
  private disposed = false
  private readonly state: State
  private readonly io: {
    get(id: string): Promise<Session>
    list(): Promise<Pane[]>
    prefix: string
    max: number
    launch(session: Session, label: string): Promise<void>
    close(id: string): Promise<void>
    report(message: string): void
    safeToClose?(id: string): Promise<boolean>
    canClosePane?(pane: Pane): boolean
  }
  constructor(state: State, io: Manager["io"]) {
    this.state = state
    this.io = io
  }

  // Shared across reload generations: old in-flight layout work finishes first.
  private enqueue(work: () => Promise<void>) {
    this.state.tail = this.state.tail.then(work).catch((error) => {
      this.io.report(`Herdr autopanes: ${error instanceof Error ? error.message : String(error)}`)
    })
    return this.state.tail
  }

  private async get(id: string) {
    const session = await this.io.get(id)
    if (session.id !== id) throw new Error("Session identity mismatch; refusing viewer launch")
    return session
  }

  async descendant(id: string) {
    const visited = new Set<string>()
    while (id && !visited.has(id)) {
      if (id === this.state.owner) return true
      visited.add(id)
      const session = await this.get(id)
      id = session.parentID ?? ""
    }
    return false
  }

  consider(id: string) {
    return this.enqueue(async () => {
      if (this.disposed || !this.state.owner || id === this.state.owner || this.state.seen.has(id)) return
      const session = await this.get(id)
      if (!session.parentID || !await this.descendant(session.parentID) || this.disposed) return
      // Claim before touching Herdr: even failed layout discovery must deduplicate.
      this.state.seen.add(id)
      const panes = (await this.io.list()).filter((p) => owns(p, this.io.prefix))
      if (panes.some((p) => paneSession(p, this.io.prefix) === id)) {
        return
      }
      if (panes.length >= this.io.max) {
        this.io.report(`Herdr autopanes: pane limit ${this.io.max}; no viewer for ${id}. Agent continues normally. Retained panes count; close one, then /herdr-autopanes-retry.`)
        return
      }
      const title = (session.title ?? "subagent").replace(/[\x00-\x1f\x7f-\x9f]/g, " ").slice(0, 60)
      if (!this.disposed) await this.io.launch(session, `${this.io.prefix}${id} ${title}`)
    })
  }

  cleanup() {
    return this.enqueue(async () => {
      // Ownership labels include the owning terminal context, not just project.
      for (const pane of await this.io.list()) {
        if (!owns(pane, this.io.prefix)) continue
        try { await this.io.close(pane.pane_id) }
        catch (error) { this.io.report(`Could not close ${pane.pane_id}: ${String(error)}`) }
      }
      this.io.report("Plugin-owned viewers closed. Child sessions keep running on the OpenCode server.")
    })
  }

  sweep(delayMs: number, now = Date.now()) {
    return this.enqueue(async () => {
      if (this.disposed || !this.io.safeToClose) return
      for (const pane of await this.io.list()) {
        if (!owns(pane, this.io.prefix)) continue
        const id = paneSession(pane, this.io.prefix)
        if (!id || pane.focused || this.io.canClosePane?.(pane) === false ||
            !["idle", "done"].includes(pane.tokens?.ocap_status ?? pane.agent_status ?? "") ||
            !await this.io.safeToClose(id)) {
          this.state.completed.delete(pane.pane_id)
          continue
        }
        const since = this.state.completed.get(pane.pane_id) ?? now
        this.state.completed.set(pane.pane_id, since)
        if (now - since < delayMs) continue
        const current = (await this.io.list()).find((p) => p.pane_id === pane.pane_id)
        if (!current || !owns(current, this.io.prefix) || current.focused ||
            !["idle", "done"].includes(current.tokens?.ocap_status ?? current.agent_status ?? "") ||
            !await this.io.safeToClose(id) || this.io.canClosePane?.(current) === false) continue
        if (this.disposed) return
        await this.io.close(pane.pane_id)
        this.state.completed.delete(pane.pane_id)
      }
    })
  }

  retry(ids: string[]) {
    return this.enqueue(async () => {
      for (const id of ids) this.state.seen.delete(id)
    }).then(() => Promise.all(ids.map((id) => this.consider(id)))).then(() => {})
  }

  dispose() { this.disposed = true }
}
