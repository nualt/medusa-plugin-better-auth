import type { BetterAuthOptions } from "better-auth" with { "resolution-mode": "import" }
import type { LazyBetterAuthPlugin } from "./lazy-plugins"

export type AutoLinkPolicy = "verified-email" | "never"

/**
 * Options passed to the plugin in medusa-config.ts.
 */
export interface BetterAuthPluginOptions {
  /**
   * Passthrough Better Auth configuration. `database` and `basePath` are
   * managed by the plugin and cannot be set here.
   */
  betterAuth: Omit<BetterAuthOptions, "database" | "basePath" | "plugins"> & {
    plugins?: (
      | NonNullable<BetterAuthOptions["plugins"]>[number]
      | LazyBetterAuthPlugin
    )[]
  }
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
  /**
   * Normalize new Medusa customer and cart emails to lowercase, and resolve
   * native email/password logins case-insensitively. Disable only when the
   * store intentionally treats the email local-part as case-sensitive.
   */
  normalizeCustomerEmails?: boolean
}

/**
 * Options after resolution against the Medusa config module.
 */
export interface ResolvedPluginOptions {
  betterAuth: BetterAuthPluginOptions["betterAuth"]
  autoLink: AutoLinkPolicy
  autoMigrate: boolean
  normalizeCustomerEmails: boolean
  databaseUrl: string
  trustedOrigins: string[]
}
