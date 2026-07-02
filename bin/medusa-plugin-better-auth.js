#!/usr/bin/env node
"use strict"

// Thin launcher over the compiled CLI so the published package exposes a
// bin without shipping source. Kept in plain CJS: it must run before any
// build tooling is available.
const path = require("path")

// Mirror @medusajs/cli: register ts-node when available so a TypeScript
// medusa-config loads in development. Production deploys run against the
// compiled .medusa/server output where the config is plain JS. ts-node is
// not a dependency of this plugin, so resolve it from the invoking project
// (directly, or through its @medusajs/cli install).
function registerTsNode() {
  const candidates = [
    () => require.resolve("ts-node", { paths: [process.cwd()] }),
    () =>
      require.resolve("ts-node", {
        paths: [
          path.dirname(
            require.resolve("@medusajs/cli/package.json", {
              paths: [process.cwd()],
            })
          ),
        ],
      }),
  ]
  for (const resolve of candidates) {
    try {
      require(resolve()).register({})
      return
    } catch {
      // Try the next resolution strategy; a JS config needs none of them.
    }
  }
}
registerTsNode()

async function run() {
  const { main } = require(
    path.join(__dirname, "..", ".medusa", "server", "src", "cli", "migrate.js")
  )
  const code = await main()
  // The Better Auth pg Pool keeps idle connections open; exit explicitly
  // once the command has finished instead of waiting on the event loop.
  process.exit(code)
}

run().catch((err) => {
  console.error("[medusa-plugin-better-auth] Command failed:", err)
  process.exit(1)
})
