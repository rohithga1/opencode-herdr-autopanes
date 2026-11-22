// Never put URL credentials/tickets in CLI argv or send Basic auth over remote HTTP.
export function validateEndpoint(endpoint) {
  let url
  try {
    if (typeof endpoint.url !== "string" || /[\x00-\x20\x7f]/.test(endpoint.url)) throw new Error()
    url = new URL(endpoint.url)
  }
  catch { throw new Error("Invalid OpenCode server URL") }
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/" || (url.protocol === "http:" && !loopback)) {
    throw new Error("Server URL must be an HTTPS or loopback HTTP origin, without credentials, path, query or fragment")
  }
  if (endpoint.auth && (endpoint.auth.type !== "basic" || endpoint.auth.username !== "opencode" ||
      typeof endpoint.auth.password !== "string")) {
    throw new Error("Only OpenCode Basic authentication is supported")
  }
  return endpoint
}

/** @type {typeof globalThis.fetch} */
export const noRedirectFetch = (input, init) => fetch(input, { ...init, redirect: "error" })
