import type { ConfigModule } from "@medusajs/framework/types"
import type { BetterAuthPluginOptions, ResolvedPluginOptions } from "./types"

export const PLUGIN_NAME = "medusa-plugin-better-auth"

function isPluginEntry(resolve: string): boolean {
  return (
    resolve === PLUGIN_NAME ||
    resolve.endsWith(`/${PLUGIN_NAME}`) ||
    resolve.endsWith(`\\${PLUGIN_NAME}`)
  )
}

export function resolvePluginOptions(config: ConfigModule): ResolvedPluginOptions {
  const entry = (config.plugins ?? []).find((plugin) =>
    typeof plugin === "string"
      ? isPluginEntry(plugin)
      : isPluginEntry(String(plugin.resolve))
  )

  const options = (
    entry && typeof entry === "object" ? entry.options : undefined
  ) as BetterAuthPluginOptions | undefined

  if (!options?.betterAuth) {
    throw new Error(
      `[${PLUGIN_NAME}] plugin entry with a "betterAuth" option is required in medusa-config.ts`
    )
  }

  const secret = options.betterAuth.secret ?? process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error(
      `[${PLUGIN_NAME}] a secret is required: set BETTER_AUTH_SECRET or options.betterAuth.secret`
    )
  }

  const databaseUrl = config.projectConfig.databaseUrl
  if (!databaseUrl) {
    throw new Error(`[${PLUGIN_NAME}] projectConfig.databaseUrl is required`)
  }

  const { authCors, storeCors, adminCors } = config.projectConfig.http
  const trustedOrigins = [
    ...new Set(
      [authCors, storeCors, adminCors]
        .filter(Boolean)
        .flatMap((value) => String(value).split(","))
        .map((origin) => origin.trim())
        // Medusa CORS values may contain regex patterns (strings starting
        // with "/"); Better Auth trustedOrigins only takes plain origins.
        .filter((origin) => origin.length > 0 && !origin.startsWith("/"))
    ),
  ]

  return {
    betterAuth: { ...options.betterAuth, secret },
    autoLink: options.autoLink ?? "verified-email",
    autoMigrate: options.autoMigrate ?? process.env.NODE_ENV !== "production",
    databaseUrl,
    trustedOrigins,
  }
}
