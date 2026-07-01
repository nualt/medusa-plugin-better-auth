import { Pool } from "pg"
import { configManager } from "@medusajs/framework/config"
import { resolvePluginOptions } from "./options"
import type { ResolvedPluginOptions } from "./types"

export const BASE_PATH = "/better-auth"

export type BetterAuthInstance = any

export async function buildBetterAuth(
  resolved: ResolvedPluginOptions
): Promise<BetterAuthInstance> {
  const { betterAuth } = await import("better-auth")
  const user = resolved.betterAuth
  const userTrusted = Array.isArray(user.trustedOrigins)
    ? user.trustedOrigins
    : []

  return betterAuth({
    ...user,
    database: new Pool({ connectionString: resolved.databaseUrl }),
    basePath: BASE_PATH,
    trustedOrigins: [...resolved.trustedOrigins, ...userTrusted],
    user: { modelName: "ba_user", ...user.user },
    session: { modelName: "ba_session", ...user.session },
    account: { modelName: "ba_account", ...user.account },
    verification: { modelName: "ba_verification", ...user.verification },
  })
}

let resolvedOptions: ResolvedPluginOptions | null = null
let instance: BetterAuthInstance | null = null

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

export async function getBetterAuth(): Promise<BetterAuthInstance> {
  if (!instance) {
    instance = await buildBetterAuth(getPluginOptions())
  }
  return instance
}

export async function runBetterAuthMigrations(): Promise<void> {
  // @ts-ignore - Dynamic import path, resolves at runtime
  const { getMigrations } = await import("better-auth/dist/db/get-migration.mjs")
  const auth = await getBetterAuth()
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
}
