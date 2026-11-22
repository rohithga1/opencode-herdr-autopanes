import { OpenCode } from "@opencode/client"
import { Service, type Endpoint } from "@opencode/client/service"
import type { Plugin } from "@opencode/plugin/tui"
import { validateEndpoint, noRedirectFetch } from "./endpoint.mjs"

export async function connection(ctx: Plugin.Context): Promise<Endpoint> {
  const info = await ctx.client.server.info({ signal: AbortSignal.timeout(5000) })
  const local = await Service.discover({ version: "2.3.2" })
  const arg = process.argv.findIndex((value) => value === "--server")
  const explicit = ctx.options.server ??
    (arg >= 0 ? process.argv[arg + 1] : process.argv.find((v) => v.startsWith("--server="))?.slice(9))
  const password = process.env.OPENCODE_PASSWORD ?? process.env.OPENCODE_SERVER_PASSWORD
  const candidates: Endpoint[] = [
    ...(explicit ? [{ url: String(explicit), auth: password ? { type: "basic" as const, username: "opencode", password } : undefined }] : []),
    ...(local ? [local] : []),
  ]
  for (const endpoint of candidates) {
    validateEndpoint(endpoint)
    try {
      const check = await OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint), fetch: noRedirectFetch })
        .server.info({ signal: AbortSignal.timeout(5000) })
      if (check.pid === info.pid && check.hostname === info.hostname && check.version === info.version) return endpoint
    } catch { /* Try only known credentials; never silently attach to another server. */ }
  }
  throw new Error("Cannot reproduce this TUI's server/authentication context. For an explicit server set options.server and inherit OPENCODE_PASSWORD; no viewer was opened.")
}
