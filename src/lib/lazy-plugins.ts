import { isAbsolute } from "node:path"
import { pathToFileURL } from "node:url"

export type LazyBetterAuthPlugin = {
  __lazyBetterAuthPlugin: true
  module: string
  export: string
  options?: unknown
}

function normalizeModuleSpecifier(moduleSpecifier: string): string {
  if (
    moduleSpecifier === "." ||
    moduleSpecifier === ".." ||
    moduleSpecifier.startsWith("./") ||
    moduleSpecifier.startsWith("../")
  ) {
    throw new Error(
      `[medusa-plugin-better-auth] relative Better Auth plugin module "${moduleSpecifier}" is ambiguous after compilation. Use an installed package name, an absolute path, or a file: URL.`
    )
  }

  return isAbsolute(moduleSpecifier)
    ? pathToFileURL(moduleSpecifier).href
    : moduleSpecifier
}

/**
 * Déclare un plugin Better Auth sans l'importer. Nécessaire depuis
 * medusa-config.ts (transpilé CJS) car better-auth/plugins est ESM-only :
 * le descripteur est résolu par buildBetterAuth via import() dynamique.
 */
export function lazyBetterAuthPlugin(
  exportName: string,
  options?: unknown,
  moduleSpecifier = "better-auth/plugins"
): LazyBetterAuthPlugin {
  return {
    __lazyBetterAuthPlugin: true,
    module: normalizeModuleSpecifier(moduleSpecifier),
    export: exportName,
    options,
  }
}

function isLazy(entry: unknown): entry is LazyBetterAuthPlugin {
  return (
    typeof entry === "object" &&
    entry !== null &&
    (entry as LazyBetterAuthPlugin).__lazyBetterAuthPlugin === true
  )
}

export async function resolveLazyPlugins(
  plugins: unknown[] | undefined
): Promise<unknown[]> {
  if (!plugins?.length) return []
  return Promise.all(
    plugins.map(async (entry) => {
      if (!isLazy(entry)) return entry
      const moduleSpecifier = normalizeModuleSpecifier(entry.module)
      const mod = (await import(moduleSpecifier)) as Record<string, unknown>
      const factory = mod[entry.export]
      if (typeof factory !== "function") {
        throw new Error(
          `[medusa-plugin-better-auth] export "${entry.export}" introuvable dans "${entry.module}" (plugin Better Auth paresseux)`
        )
      }
      return factory(entry.options)
    })
  )
}
