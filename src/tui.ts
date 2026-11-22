import { createHash } from "node:crypto"
import { Plugin } from "@opencode/plugin/tui"
import { Manager, enabled, newState } from "./manager.ts"
import { Herdr } from "./herdr.ts"
import { connection } from "./connection.ts"

export default Plugin.define({
  id: "herdr-autopanes",
  setup(ctx) {
    ctx.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "herdr-autopanes.status", title: "Herdr autopanes status", palette: true,
        slash: { name: "herdr-autopanes-status" },
        run: () => ctx.ui.toast.show({
          title: "Herdr autopanes",
          message: process.env.OPENCODE_HERDR_VIEWER === "1" ? "Viewer: recursive pane creation disabled." :
            enabled(process.env) ? `Owner terminal: ${process.env.HERDR_PANE_ID}` : "Inactive: not in a Herdr pane.",
        }),
      }],
    }))
    if (!enabled(process.env)) return
    const report = (message: string) => ctx.ui.toast.show({ title: "Herdr autopanes", message, variant: "warning", duration: 10000 })
    if (!process.env.HERDR_WORKSPACE_ID) {
      report("Missing caller workspace context; autopanes disabled.")
      return
    }
    const max = ctx.options.maxPanes ?? 4
    if (!Number.isSafeInteger(max) || max < 1) {
      report("maxPanes must be a positive integer; autopanes disabled.")
      return
    }
    const [memory] = ctx.storage.memory("owner", { initial: { state: newState() } })
    const state = memory.state
    const captureOwner = () => {
      const route = ctx.ui.router.current()
      if (!state.owner && route.type === "session") state.owner = route.sessionID
    }
    captureOwner()
    const key = createHash("sha256").update(`${process.env.HERDR_SOCKET_PATH}\0${process.env.HERDR_PANE_ID}`).digest("hex").slice(0, 16)
    const herdr = new Herdr(report, state.pending)
    const manager = new Manager(state, {
      get: (sessionID) => ctx.client.session.get({ sessionID }, { signal: AbortSignal.timeout(5000) }),
      list: () => herdr.list(),
      close: (id) => herdr.close(id),
      prefix: `ocap:${key}:`,
      max,
      launch: async (session, label) => herdr.launch(session, label, await connection(ctx)),
      report,
    })
    const stops = [
      ctx.data.on("session.created", (event) => {
        captureOwner()
        if (event.data.parentID) void manager.consider(event.data.sessionID)
      }),
      ctx.data.on("session.execution.started", (event) => {
        captureOwner()
        void manager.consider(event.data.sessionID)
      }),
    ]
    ctx.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "herdr-autopanes.cleanup", title: "Close plugin-owned Herdr viewers (agents keep running)",
          palette: true, slash: { name: "herdr-autopanes-cleanup" },
          run: async () => {
            if (await ctx.ui.dialog.confirm({ title: "Close Herdr viewers?", message: "Only this terminal's plugin-owned panes close. Underlying child sessions keep running." })) await manager.cleanup()
          },
        },
        {
          id: "herdr-autopanes.retry", title: "Retry Herdr viewers for current descendants",
          palette: true, slash: { name: "herdr-autopanes-retry", arguments: true },
          run: (input) => manager.retry(input?.trim() ? [input.trim()] : [...state.seen]),
        },
      ],
    }))
    const timer = setInterval(() => {
      captureOwner()
      void herdr.check().catch(() => report("Viewer status check failed."))
    }, 1000)
    return () => {
      manager.dispose()
      clearInterval(timer)
      stops.forEach((stop) => stop())
    }
  },
})
