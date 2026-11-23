import { createHash } from "node:crypto"
import { Plugin } from "@opencode/plugin/tui"
import { Manager, closeSummaryMessage, enabled, newState } from "./manager.ts"
import { Herdr } from "./herdr.ts"
import { connection } from "./connection.ts"
import { activity } from "./activity.ts"
import { FocusGuard } from "./focus.ts"

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
    const mode = ctx.options.mode ?? "tabs"
    const closeDelay = ctx.options.closeDelaySeconds ?? 60
    if (!["tabs", "split"].includes(mode) || typeof ctx.options.closeOnCompletion !== "undefined" &&
        typeof ctx.options.closeOnCompletion !== "boolean" ||
        typeof closeDelay !== "number" || !Number.isFinite(closeDelay) || closeDelay < 0) {
      report("Invalid mode, closeOnCompletion or closeDelaySeconds; autopanes disabled.")
      return
    }
    if (!Number.isSafeInteger(max) || max < 1) {
      report("maxPanes must be a positive integer; autopanes disabled.")
      return
    }
    const [memory] = ctx.storage.memory("owner", { initial: { state: newState() } })
    const state = memory.state
    state.completed ??= new Map()
    const captureOwner = () => {
      const route = ctx.ui.router.current()
      if (!state.owner && route.type === "session") state.owner = route.sessionID
    }
    captureOwner()
    const key = createHash("sha256").update(`${process.env.HERDR_SOCKET_PATH}\0${process.env.HERDR_PANE_ID}`).digest("hex").slice(0, 16)
    const herdr = new Herdr(report, state.pending, mode)
    const focus = ctx.options.closeOnCompletion === true
      ? new FocusGuard(process.env.HERDR_SOCKET_PATH!, report) : undefined
    let named = false
    const nameOwner = () => {
      if (named || !state.owner) return
      named = true
      void ctx.client.session.get({ sessionID: state.owner }).then((session) =>
        herdr.describeOwner((session.title ?? "Main agent").replace(/[\x00-\x1f\x7f-\x9f]/g, " ").slice(0, 60))
      ).catch(() => { named = false })
    }
    nameOwner()
    const manager = new Manager(state, {
      get: (sessionID) => ctx.client.session.get({ sessionID }, { signal: AbortSignal.timeout(5000) }),
      list: () => herdr.list(),
      close: (id) => herdr.close(id),
      prefix: `ocap:${key}:`,
      max,
      launch: async (session, label) => herdr.launch(session, label, await connection(ctx)),
      report,
      safeToClose: async (sessionID) => {
        return await activity(ctx.client, sessionID) === "done"
      },
      canClosePane: (pane) => pane.tokens?.ocap_pin === "1"
        ? "explicitly pinned"
        : focus ? focus.canClose(pane.pane_id) : true,
    })
    const stops = [
      ctx.data.on("session.created", (event) => {
        captureOwner()
        if (event.data.parentID) void manager.consider(event.data.sessionID)
      }),
      ctx.data.on("session.execution.started", (event) => {
        captureOwner()
        void manager.consider(event.data.sessionID).then(() =>
          herdr.status(`ocap:${key}:`, event.data.sessionID, "working")).catch(() => {})
      }),
      ...(["session.execution.succeeded", "session.execution.failed", "session.execution.interrupted"] as const)
        .map((type) => ctx.data.on(type, (event) => {
          void manager.consider(event.data.sessionID).then(() =>
            herdr.status(`ocap:${key}:`, event.data.sessionID, () => activity(ctx.client, event.data.sessionID))).catch(() => {})
        })),
      ctx.data.on("permission.asked", (event) => {
        void herdr.status(`ocap:${key}:`, event.data.sessionID, "blocked").catch(() => {})
      }),
      ctx.data.on("form.created", (event) => {
        void herdr.status(`ocap:${key}:`, event.data.form.sessionID, "blocked").catch(() => {})
      }),
      ctx.data.on("permission.replied", (event) => {
        void herdr.status(`ocap:${key}:`, event.data.sessionID, "working").catch(() => {})
      }),
      ctx.data.on("form.replied", (event) => {
        void herdr.status(`ocap:${key}:`, event.data.sessionID, "working").catch(() => {})
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
          id: "herdr-autopanes.close-completed",
          title: "Close completed Herdr viewers (conversations preserved)",
          palette: true, slash: { name: "herdr-autopanes-close-completed" },
          run: async () => {
            const summary = await manager.closeCompleted()
            ctx.ui.toast.show({
              title: "Herdr autopanes",
              message: closeSummaryMessage(summary),
            })
          },
        },
        {
          id: "herdr-autopanes.retry", title: "Retry Herdr viewers for current descendants",
          palette: true, slash: { name: "herdr-autopanes-retry", arguments: true },
          run: (input) => manager.retry(input?.trim() ? [input.trim()] : [...state.seen]),
        },
      ],
    }))
    let sweeping = false
    let refreshing = false
    let tick = 0
    const timer = setInterval(() => {
      captureOwner()
      nameOwner()
      void herdr.check().catch(() => report("Viewer status check failed."))
      if (++tick % 5 === 0 && !refreshing) {
        refreshing = true
        void herdr.list().then(async (panes) => {
          for (const pane of panes) {
            if (pane.tokens?.ocap_owner !== `ocap:${key}:` || !pane.tokens.ocap_session) continue
            await herdr.status(`ocap:${key}:`, pane.tokens.ocap_session,
              await activity(ctx.client, pane.tokens.ocap_session))
          }
        }).catch(() => {}).finally(() => { refreshing = false })
      }
      if (ctx.options.closeOnCompletion === true && !sweeping) {
        sweeping = true
        void manager.sweep(closeDelay * 1000).finally(() => { sweeping = false })
      }
    }, 1000)
    return () => {
      manager.dispose()
      focus?.dispose()
      clearInterval(timer)
      stops.forEach((stop) => stop())
    }
  },
})
