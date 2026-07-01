import { Pool } from "pg"
import { configManager } from "@medusajs/framework/config"
import { resolvePluginOptions } from "./options"
import type { ResolvedPluginOptions } from "./types"
import type { betterAuth } from "better-auth" with { "resolution-mode": "import" }

export const BASE_PATH = "/better-auth"

export type BetterAuthInstance = ReturnType<typeof betterAuth>

export async function buildBetterAuth(
  resolved: ResolvedPluginOptions
): Promise<BetterAuthInstance> {
  const { betterAuth } = await import("better-auth")
  const user = resolved.betterAuth
  const userTrusted = Array.isArray(user.trustedOrigins)
    ? user.trustedOrigins
    : []

  // Cast needed: betterAuth<{specific}> returns Auth<{specific}> which is
  // structurally incompatible with Auth<BetterAuthOptions> at the generic
  // type level even though specific extends BetterAuthOptions.
  return betterAuth({
    ...user,
    database: new Pool({ connectionString: resolved.databaseUrl }),
    basePath: BASE_PATH,
    trustedOrigins: [...resolved.trustedOrigins, ...userTrusted],
    user: { modelName: "ba_user", ...user.user },
    session: { modelName: "ba_session", ...user.session },
    account: { modelName: "ba_account", ...user.account },
    verification: { modelName: "ba_verification", ...user.verification },
  }) as unknown as BetterAuthInstance
}

let resolvedOptions: ResolvedPluginOptions | null = null
// Stores the in-flight/resolved promise to prevent concurrent first-callers
// from racing past the null check and creating duplicate pg Pools.
let instancePromise: Promise<BetterAuthInstance> | null = null

/**
 * Options singleton — reads the Medusa config module loaded for this
 * process, so routes, middlewares and the auth provider all see the same
 * configuration without re-declaring it.
 */
export function getPluginOptions(): ResolvedPluginOptions {
  if (!resolvedOptions) {
    resolvedOptions = resolvePluginOptions(configManager.config)
  }
  return resolvedOptions
}

export function getBetterAuth(): Promise<BetterAuthInstance> {
  if (!instancePromise) {
    instancePromise = buildBetterAuth(getPluginOptions())
  }
  return instancePromise
}

export async function runBetterAuthMigrations(): Promise<void> {
  const { getMigrations } = await import("better-auth/db/migration")
  const auth = await getBetterAuth()
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
}
