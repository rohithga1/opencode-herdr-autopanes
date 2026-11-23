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
export type CloseSkipReason =
  | "currently inspected"
  | "explicitly pinned"
  | "inspection unavailable"
  | "ownership or session identity uncertain"
  | "native work still running or blocked"
  | "completion state uncertain"
  | "viewer changed or ownership became uncertain"
  | "state/API could not be verified"
export type CloseSummary = {
  closed: number
  skipped: Record<string, number>
  failed: number
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
    canClosePane?(pane: Pane): true | CloseSkipReason
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
        this.io.report(`Herdr autopanes: pane limit ${this.io.max}; no viewer for ${id}. Agent continues normally. Retained panes count; use /herdr-autopanes-close-completed, then /herdr-autopanes-retry.`)
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
      this.io.report("Viewer tabs closed. Conversations preserved; any active work continues.")
    })
  }

  private async closeEligible(delayMs: number, now: number, summary?: CloseSummary) {
    if (this.disposed || !this.io.safeToClose) return
    const skip = (reason: CloseSkipReason) => {
      if (summary) summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1
    }
    const safe = async (id: string): Promise<boolean | undefined> => {
      try { return await this.io.safeToClose!(id) }
      catch { return undefined }
    }
    for (const pane of await this.io.list()) {
      if (!owns(pane, this.io.prefix)) continue
      const id = paneSession(pane, this.io.prefix)
      if (!id) {
        skip("ownership or session identity uncertain")
        this.state.completed.delete(pane.pane_id)
        continue
      }
      if (pane.focused) {
        skip("currently inspected")
        this.state.completed.delete(pane.pane_id)
        continue
      }
      const block = this.io.canClosePane?.(pane)
      if (block !== undefined && block !== true) {
        skip(block)
        this.state.completed.delete(pane.pane_id)
        continue
      }
      const status = pane.tokens?.ocap_status ?? pane.agent_status ?? ""
      if (!["idle", "done"].includes(status)) {
        skip(status === "working" ? "native work still running or blocked" : "completion state uncertain")
        this.state.completed.delete(pane.pane_id)
        continue
      }
      const safeState = await safe(id)
      if (safeState === undefined) {
        skip("state/API could not be verified")
        this.state.completed.delete(pane.pane_id)
        continue
      }
      if (!safeState) {
        skip("native work still running or blocked")
        this.state.completed.delete(pane.pane_id)
        continue
      }
      const since = this.state.completed.get(pane.pane_id) ?? now
      this.state.completed.set(pane.pane_id, since)
      if (now - since < delayMs) continue
      const current = (await this.io.list()).find((p) => p.pane_id === pane.pane_id)
      if (!current || !owns(current, this.io.prefix)) {
        skip("viewer changed or ownership became uncertain")
        continue
      }
      if (current.focused) {
        skip("currently inspected")
        continue
      }
      const currentBlock = this.io.canClosePane?.(current)
      if (currentBlock !== undefined && currentBlock !== true) {
        skip(currentBlock)
        continue
      }
      const currentStatus = current.tokens?.ocap_status ?? current.agent_status ?? ""
      const currentSafe = await safe(id)
      if (!["idle", "done"].includes(currentStatus)) {
        skip(currentStatus === "working" ? "native work still running or blocked" : "completion state uncertain")
        continue
      }
      if (currentSafe === undefined) {
        skip("state/API could not be verified")
        continue
      }
      if (!currentSafe) {
        skip("native work still running or blocked")
        continue
      }
      if (this.disposed) return
      try {
        await this.io.close(pane.pane_id)
        if (summary) summary.closed++
      } catch (error) {
        if (summary) summary.failed++
        this.io.report(`Could not close ${pane.pane_id}: ${String(error)}`)
        continue
      }
      this.state.completed.delete(pane.pane_id)
    }
  }

  sweep(delayMs: number, now = Date.now()) {
    return this.enqueue(() => this.closeEligible(delayMs, now))
  }

  closeCompleted() {
    const summary: CloseSummary = { closed: 0, skipped: {}, failed: 0 }
    return this.enqueue(async () => {
      try {
        await this.closeEligible(0, Date.now(), summary)
      } catch (error) {
        summary.skipped["state/API could not be verified"] =
          (summary.skipped["state/API could not be verified"] ?? 0) + 1
        this.io.report(`Herdr autopanes: ${error instanceof Error ? error.message : String(error)}`)
      }
    }).then(() => summary)
  }

  retry(ids: string[]) {
    return this.enqueue(async () => {
      for (const id of ids) this.state.seen.delete(id)
    }).then(() => Promise.all(ids.map((id) => this.consider(id)))).then(() => {})
  }

  dispose() { this.disposed = true }
}

export function closeSummaryMessage(summary: CloseSummary) {
  const entries = Object.entries(summary.skipped)
  const skipped = entries.reduce((total, [, count]) => total + count, 0)
  const reasons = entries.length ? entries.map(([reason, count]) => `${reason}: ${count}`).join(", ") : "none"
  return `Closed ${summary.closed} completed viewer tab${summary.closed === 1 ? "" : "s"}; ` +
    `skipped ${skipped} (${reasons}); closure failures: ${summary.failed}. ` +
    "Conversations preserved; any active work continues."
}
