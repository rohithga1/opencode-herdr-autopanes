import assert from "node:assert/strict"
import { test } from "node:test"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, readdir, rm, writeFile, stat, symlink, unlink } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

test("local install/uninstall preserve settings, back up original, and are idempotent", async () => {
  const dir = await mkdtemp("/tmp/opencode/autopanes-install-test-")
  try {
    const path = join(dir, "cli.json")
    const original = '{\n  "theme": {"mode": "system"}, "plugins": ["./existing"]\n}\n'
    await writeFile(path, original)
    const installer = fileURLToPath(new URL("../scripts/install.mjs", import.meta.url))
    const run = (args: string[] = []) => execFileSync(process.execPath, [installer, ...args], {
      env: { ...process.env, OPENCODE_CONFIG_DIR: dir }, encoding: "utf8",
    })
    run()
    const backups = (await readdir(dir)).filter((name) => name.endsWith(".bak"))
    assert.equal(backups.length, 1)
    assert.equal(await readFile(join(dir, backups[0]!), "utf8"), original)
    assert.equal((await stat(join(dir, backups[0]!))).mode & 0o777, 0o600)
    const installed = JSON.parse(await readFile(path, "utf8"))
    assert.deepEqual(installed.theme, { mode: "system" })
    assert.equal(installed.plugins[0], "./existing")
    assert.equal(installed.plugins.length, 2)
    assert.match(run(), /Already installed/)
    installed.animations = false
    // Object/options form must also uninstall without removing later user edits.
    installed.plugins[1] = { package: installed.plugins[1], options: { maxPanes: 2 } }
    await writeFile(path, JSON.stringify(installed))
    run(["--remove"])
    const removed = JSON.parse(await readFile(path, "utf8"))
    assert.deepEqual(removed.plugins, ["./existing"])
    assert.equal(removed.animations, false)
    assert.match(run(["--remove"]), /Already uninstalled/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("installer refuses symlink-managed, malformed and non-object settings without modifying them", async () => {
  const dir = await mkdtemp("/tmp/opencode/autopanes-install-safety-")
  try {
    const installer = fileURLToPath(new URL("../scripts/install.mjs", import.meta.url))
    const run = () => execFileSync(process.execPath, [installer], {
      env: { ...process.env, OPENCODE_CONFIG_DIR: dir }, stdio: "pipe",
    })
    const path = join(dir, "cli.json"), target = join(dir, "managed.json")
    await writeFile(target, '{"plugins":["keep"]}')
    await symlink(target, path)
    assert.throws(run)
    assert.equal(await readFile(target, "utf8"), '{"plugins":["keep"]}')
    await unlink(path)
    for (const text of ["{ invalid", "[]", "null", '{"plugins":{}}']) {
      await writeFile(path, text)
      assert.throws(run)
      assert.equal(await readFile(path, "utf8"), text)
    }
    assert.equal((await readdir(dir)).some((name) => name.endsWith(".bak")), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
