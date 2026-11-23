import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"
import type { Endpoint } from "@opencode/client/service"
import type { Pane, Session } from "./manager.ts"
import { validateEndpoint } from "./endpoint.mjs"

const exec = promisify(execFile)
export const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'"
export const viewerPath = fileURLToPath(new URL("./viewer.mjs", import.meta.url))

export class Herdr {
  private readonly env = { ...process.env }
  private direction = 0
  private readonly report: (message: string) => void
  private readonly pending: Map<string, number>
  private readonly mode: "tabs" | "split"
  constructor(report: (message: string) => void, pending = new Map<string, number>(), mode: "tabs" | "split" = "tabs") {
    this.report = report
    this.pending = pending
    this.mode = mode
  }

  private async call(args: string[]) {
    try {
      const { stdout } = await exec("herdr", args, { env: this.env, timeout: 10000, maxBuffer: 1024 * 1024 })
      // Herdr 0.9.5's write-only commands can succeed without a JSON response.
      if (!stdout.trim()) return
      const response = JSON.parse(stdout)
      if (response.error) throw new Error(response.error.message)
      return response.result
    } catch {
      // Do not leak command arguments, inherited credentials, or terminal output.
      throw new Error(`Herdr ${args.slice(0, 2).join(" ")} failed (missing binary, unavailable socket, timeout, or CLI error).`)
    }
  }

  async list(): Promise<Pane[]> {
    const result = await this.call(["pane", "list", "--workspace", this.env.HERDR_WORKSPACE_ID!])
    if (!Array.isArray(result?.panes)) throw new Error("Unexpected Herdr pane list response")
    return result.panes
  }

  async close(id: string) { await this.call(["pane", "close", id]) }

  async describeOwner(title: string) {
    await this.call(["pane", "report-metadata", this.env.HERDR_PANE_ID!, "--source", "opencode-herdr-autopanes",
      "--token", `hs_title=${title}`])
  }

  async status(prefix: string, sessionID: string, status: string | (() => Promise<string>)) {
    const pane = (await this.list()).find((p) => p.tokens?.ocap_owner === prefix &&
      p.tokens.ocap_session === sessionID)
    if (!pane) return
    const value = typeof status === "string" ? status : await status()
    if (pane.tokens?.ocap_status === value) return
    await this.call(["pane", "report-metadata", pane.pane_id, "--source", "opencode-herdr-autopanes",
      "--token", `ocap_status=${value}`])
    // Optional display integration; absence must never affect native agents.
    try { await this.call(["plugin", "action", "invoke", "refresh", "--plugin", "testy-cool.herdr-sidebar"]) }
    catch { /* Stock Herdr can still display the flat background terminals. */ }
  }

  async launch(session: Session, label: string, endpoint: Endpoint) {
    validateEndpoint(endpoint)
    if (!/^ses_[A-Za-z0-9]+$/.test(session.id) || !isAbsolute(session.location.directory) ||
        /[\x00-\x1f\x7f]/.test(session.location.directory)) {
      throw new Error("Invalid child session ID or directory; refusing viewer launch")
    }
    if (session.location.workspaceID) throw new Error("Remote workspace locations are not supported; agent continues normally.")
    const dir = await mkdtemp(join(process.env.OPENCODE_TMP_DIR ?? (tmpdir() === "/tmp" ? "/tmp/opencode" : tmpdir()), "herdr-viewer-"))
    this.pending.set(dir, Date.now())
    const config = join(dir, "launch.json")
    const status = join(dir, "status.json")
    let pane: string | undefined
    try {
      await writeFile(config, JSON.stringify({
        executable: process.env.OPENCODE_HERDR_BINARY ?? process.execPath,
        args: ["--server", endpoint.url, "--session", session.id, session.location.directory],
        env: {
          OPENCODE_HERDR_VIEWER: "1",
          OPENCODE_CONFIG_DIR: this.env.OPENCODE_CONFIG_DIR,
          ...(endpoint.auth ? { OPENCODE_PASSWORD: endpoint.auth.password } : {}),
        },
        endpoint,
        sessionID: session.id,
        status,
      }), { mode: 0o600, flag: "wx" })
      const title = label.slice(label.indexOf(session.id) + session.id.length).trim() || "subagent"
      const prefix = label.slice(0, label.indexOf(session.id))
      const result = await this.call(this.mode === "tabs"
        ? ["tab", "create", "--workspace", this.env.HERDR_WORKSPACE_ID!, "--label", title,
            "--cwd", session.location.directory, "--env", "OPENCODE_HERDR_VIEWER=1", "--no-focus"]
        // ponytail: split mode retains the old alternating layout, not adaptive tiling.
        : ["pane", "split", "--pane", this.env.HERDR_PANE_ID!,
            "--direction", this.direction++ % 2 ? "down" : "right", "--cwd", session.location.directory,
            "--env", "OPENCODE_HERDR_VIEWER=1", "--no-focus"])
      pane = result?.root_pane?.pane_id ?? result?.pane?.pane_id
      if (!pane) throw new Error("Unexpected Herdr viewer creation response")
      await this.call(["pane", "rename", pane, title])
      await this.call(["pane", "report-metadata", pane, "--source", "opencode-herdr-autopanes",
        "--token", `ocap_owner=${prefix}`, "--token", `ocap_session=${session.id}`,
        "--token", `ocap_parent=${this.env.HERDR_PANE_ID}`, "--token", `hs_parent=${this.env.HERDR_PANE_ID}`,
        "--token", "ocap_status=working", "--token", `hs_title=${title}`])
      // pane run accepts shell text, not argv. Quote every token for POSIX shells.
      await this.call(["pane", "run", pane, ["node", viewerPath, config].map(quote).join(" ")])
    } catch (error) {
      if (pane) {
        try { await this.close(pane) }
        catch { this.report(`Launch failed; plugin-created pane ${pane} could not be closed.`) }
      }
      await rm(dir, { recursive: true, force: true })
      this.pending.delete(dir)
      throw error
    }
  }

  async check() {
    for (const [dir, created] of this.pending) {
      try {
        const status = JSON.parse(await readFile(join(dir, "status.json"), "utf8"))
        if (status.error) this.report(`Herdr viewer failed: ${status.error}. Pane retained; child agent is unaffected.`)
        if (status.done) {
          await rm(dir, { recursive: true, force: true })
          this.pending.delete(dir)
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT" && Date.now() - created > 30000) {
          this.report("Viewer did not acknowledge startup within 30 seconds. Pane retained; child agent is unaffected.")
          await rm(dir, { recursive: true, force: true })
          this.pending.delete(dir)
        } else if ((error as NodeJS.ErrnoException).code !== "ENOENT") this.report("Could not read viewer launch status.")
      }
    }
  }
}
