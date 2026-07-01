import type { BetterAuthOptions } from "better-auth" with { "resolution-mode": "import" }

export type AutoLinkPolicy = "verified-email" | "never"

/**
 * Options passed to the plugin in medusa-config.ts.
 */
export interface BetterAuthPluginOptions {
  /**
   * Passthrough Better Auth configuration. `database` and `basePath` are
   * managed by the plugin and cannot be set here.
   */
  betterAuth: Omit<BetterAuthOptions, "database" | "basePath">
  /**
   * Whether a Better Auth identity may be linked automatically to an
   * existing Medusa actor sharing the same email. "verified-email"
   * requires the email to be verified on the Better Auth side.
   */
  autoLink?: AutoLinkPolicy
  /**
   * Run Better Auth schema migrations at boot.
   */
  autoMigrate?: boolean
}

/**
 * Options after resolution against the Medusa config module.
 */
export interface ResolvedPluginOptions {
  betterAuth: BetterAuthPluginOptions["betterAuth"]
  autoLink: AutoLinkPolicy
  autoMigrate: boolean
  databaseUrl: string
  trustedOrigins: string[]
}
