// Credentials travel through a private one-use file, never shell arguments.
import { readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { spawn } from "node:child_process"
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"
import { validateEndpoint, noRedirectFetch } from "./endpoint.mjs"

const path = process.argv[2]
let config
try {
  config = JSON.parse(readFileSync(path, "utf8"))
} catch {
  console.error("Herdr autopanes: could not read private launch configuration.")
  process.exitCode = 1
} finally {
  try { unlinkSync(path) } catch { /* Never print a launch file's contents. */ }
}
if (!config) process.exit(1)
const status = (value) => writeFileSync(config.status, JSON.stringify(value), { mode: 0o600 })
try {
  // --session creates missing IDs in 2.3.2: never attach without checking first.
  validateEndpoint(config.endpoint)
  await OpenCode.make({ baseUrl: config.endpoint.url, headers: Service.headers(config.endpoint), fetch: noRedirectFetch })
    .session.get({ sessionID: config.sessionID }, { signal: AbortSignal.timeout(5000) })
} catch {
  status({ done: true, error: "Existing child session could not be verified; refusing to create a session" })
  console.error("Herdr autopanes: existing child session unavailable; viewer not started.")
  process.exit(1)
}
const child = spawn(config.executable, config.args, {
  env: { ...process.env, ...config.env },
  stdio: "inherit",
})
child.on("spawn", () => status({ started: true }))
child.on("error", () => {
  status({ done: true, error: "OpenCode executable could not start" })
  console.error("Herdr autopanes: OpenCode executable could not start.")
  process.exitCode = 1
})
child.on("exit", (code, signal) => {
  status({ done: true, ...(code !== 0 ? { error: `OpenCode exited (${code ?? signal})` } : {}) })
  process.exitCode = code ?? 1
})
