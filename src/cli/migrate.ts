import { configLoader } from "@medusajs/framework/config"
import { runBetterAuthMigrations } from "../lib/better-auth"

const USAGE = `Usage: medusa-plugin-better-auth migrate

Applies the Better Auth schema migrations (ba_* tables) to the database
configured in medusa-config. Run it from your Medusa project root (the
directory you run \`medusa start\` from), e.g. during deploy:

  npx medusa-plugin-better-auth migrate
`

export async function main(
  argv: string[] = process.argv.slice(2)
): Promise<number> {
  if (argv.length !== 1 || argv[0] !== "migrate") {
    process.stderr.write(USAGE)
    return 1
  }

  // The CLI always runs in a fresh process, so the plugin-local
  // configManager singleton is empty: hydrate it from the project's
  // medusa-config before resolving plugin options. (Probing
  // configManager.config first is not an option — the getter warns in
  // development and throws in production when nothing is loaded yet.)
  await configLoader(process.cwd(), "medusa-config")

  await runBetterAuthMigrations()
  console.log("[medusa-plugin-better-auth] Better Auth migrations applied.")
  return 0
}
