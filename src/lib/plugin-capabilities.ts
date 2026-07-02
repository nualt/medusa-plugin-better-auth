import type { BetterAuthPluginOptions } from "./types"
import type { LazyBetterAuthPlugin } from "./lazy-plugins"

function isLazyMagicLink(entry: unknown): boolean {
  return (
    typeof entry === "object" &&
    entry !== null &&
    (entry as LazyBetterAuthPlugin).__lazyBetterAuthPlugin === true &&
    (entry as LazyBetterAuthPlugin).export === "magicLink"
  )
}

function isResolvedMagicLink(entry: unknown): boolean {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "id" in entry &&
    (entry as { id?: string }).id === "magic-link"
  )
}

/** True when the merchant configured the Better Auth magic-link plugin. */
export function isMagicLinkEnabled(
  betterAuth: BetterAuthPluginOptions["betterAuth"]
): boolean {
  const plugins = betterAuth?.plugins ?? []
  return plugins.some(
    (entry) => isLazyMagicLink(entry) || isResolvedMagicLink(entry)
  )
}
