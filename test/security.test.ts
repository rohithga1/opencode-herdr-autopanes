import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer } from "node:http"
import { validateEndpoint, noRedirectFetch } from "../src/endpoint.mjs"
import { Herdr } from "../src/herdr.ts"

test("server URL policy rejects credential/option smuggling and insecure remote HTTP", () => {
  // Synthetic "secret" values and example.com are injection fixtures, not credentials.
  for (const url of [
    "file:///etc/passwd", "http://remote.example", "ftp://localhost",
    "https://user:secret@example.com", "http://localhost?ticket=secret",
    "https://example.com/#secret", "--prompt=secret", "not a URL",
    "https://example.com/secret", "http://localhost\n",
  ]) {
    assert.throws(() => validateEndpoint({ url }), (error: unknown) =>
      error instanceof Error && !error.message.includes("secret"))
  }
  for (const url of ["http://127.0.0.1:4096", "http://localhost:4096", "http://[::1]:4096", "https://example.com"]) {
    assert.equal(validateEndpoint({ url }).url, url)
  }
  assert.throws(() => validateEndpoint({ url: "https://example.com", auth: { type: "basic", username: "other", password: "secret" } }))
})

test("preflight fetch refuses redirects instead of forwarding credentials", async () => {
  let redirected = false
  const server = createServer((request, response) => {
    if (request.url === "/target") redirected = true
    response.writeHead(302, { location: "/target" }).end()
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    const address = server.address()
    assert.ok(address && typeof address !== "string")
    await assert.rejects(noRedirectFetch(`http://127.0.0.1:${address.port}/start`, { headers: { authorization: "Basic test" } }))
    assert.equal(redirected, false)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test("viewer launch rejects option-like IDs and nonabsolute/control-bearing directories before Herdr", async () => {
  const herdr = new Herdr(() => {})
  for (const [id, directory] of [["--prompt=bad", "/project"], ["ses_valid", "--prompt=bad"], ["ses_valid", "/project\nbad"]]) {
    await assert.rejects(herdr.launch({ id: id!, location: { directory: directory! } }, "title", { url: "http://localhost" }), /Invalid child session/)
  }
})
