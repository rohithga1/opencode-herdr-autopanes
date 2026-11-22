import { mkdir, readFile, rename, writeFile, lstat, rm } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const plugin = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "")
const path = join(process.env.OPENCODE_CONFIG_DIR ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "opencode"), "cli.json")
let original
try {
  const info = await lstat(path)
  if (!info.isFile()) throw new Error("cli.json must be a regular file; register manually for symlink-managed settings")
  original = await readFile(path, "utf8")
}
catch (error) { if (error.code !== "ENOENT") throw error }
const config = original ? JSON.parse(original) : { $schema: "https://opencode.ai/v2/cli.json" }
if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("cli.json must contain an object")
const plugins = config.plugins ?? []
if (!Array.isArray(plugins)) throw new Error("cli.json plugins must be an array")
const matches = (entry) => (typeof entry === "string" ? entry : entry?.package) === plugin
const remove = process.argv.includes("--remove")
if (remove ? !plugins.some(matches) : plugins.some(matches)) {
  console.log(remove ? "Already uninstalled." : "Already installed.")
  process.exit(0)
}
config.plugins = remove ? plugins.filter((entry) => !matches(entry)) : [...plugins, plugin]
await mkdir(dirname(path), { recursive: true })
if (original !== undefined) {
  const backup = `${path}.herdr-autopanes-${Date.now()}.bak`
  await writeFile(backup, original, { mode: 0o600, flag: "wx" })
  console.log(`Backup: ${backup}`)
}
const temporary = `${path}.herdr-autopanes-${process.pid}.tmp`
await writeFile(temporary, JSON.stringify(config, null, 2) + "\n", { mode: 0o600, flag: "wx" })
try {
  let current
  try { current = await readFile(path, "utf8") }
  catch (error) { if (error.code !== "ENOENT") throw error }
  if (current !== original) throw new Error("cli.json changed during installation; retry after other settings edits finish")
  await rename(temporary, path)
} finally {
  await rm(temporary, { force: true })
}
console.log(`${remove ? "Removed" : "Installed"} ${plugin} in ${path}`)
console.log("CLI settings reload live. No server restart required. Existing viewer panes remain intact.")
