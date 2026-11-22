import { Plugin } from "@opencode/plugin"

// All terminal work belongs to the client, never the shared server process.
export default Plugin.define({ id: "herdr-autopanes", setup() {} })
