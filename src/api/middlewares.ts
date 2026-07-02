import { defineMiddlewares } from "@medusajs/framework/http"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { configLoader, configManager } from "@medusajs/framework/config"
import cors from "cors"
import {
  BASE_PATH,
  getBetterAuth,
  getPluginOptions,
  runBetterAuthMigrations,
  type BetterAuthInstance,
} from "../lib/better-auth"

const BRIDGE_PREFIX = `${BASE_PATH}/bridge`

// toNodeHandler is ESM-only (better-auth/node exports only .mjs).
// We store the handler inside the ready promise to avoid a static import
// that would break the CJS build produced by medusa plugin:build.
let nodeHandler: ((req: MedusaRequest, res: MedusaResponse) => void) | null =
  null
let corsMiddlewareHandler: ReturnType<typeof cors> | null = null

// In pnpm monorepos, each package resolves its own singleton of configManager
// because peer-dependency hashes differ between the plugin and the backend.
// We therefore bootstrap the plugin's configManager instance explicitly
// before calling getPluginOptions() / getBetterAuth().
//
// Exception: when running inside the Medusa integration test runner (or any
// environment where the app shares the same Node.js process as the plugin),
// the configManager is already populated by Medusa's core startup. Calling
// configLoader again would re-evaluate medusa-config.ts without the test
// runner's DB URL override, corrupting the singleton. We therefore skip the
// call when the config is already loaded.
//
// This is an async IIFE so that the resolved options and the Better Auth
// instance are both ready before the first request is processed.
// Any bad configuration (missing secret, unknown plugin) surfaces here and
// propagates to the first request via betterAuthRouter's try/catch.
const ready: Promise<BetterAuthInstance> = (async () => {
  // Only load the config if configManager hasn't been populated yet.
  // In tests (shared process) and in production (Medusa loads config before
  // plugins), the configManager is already initialised.
  if (!configManager.config?.projectConfig?.databaseUrl) {
    // Populate the plugin's configManager using the same config file that
    // Medusa core already loaded.  Node's require cache means the file is
    // not re-evaluated; we just hydrate the plugin-local singleton.
    await configLoader(process.cwd(), "medusa-config")
  }

  // Résolu au chargement du fichier (boot Medusa) : une config invalide
  // fait échouer le démarrage, pas la première requête.
  const options = getPluginOptions()

  // /better-auth n'est pas un namespace connu de Medusa (/store, /admin,
  // /auth) : aucun CORS n'y est appliqué par le core. On le gère ici pour
  // que le storefront (autre origine) puisse appeler les flows.
  corsMiddlewareHandler = cors({
    origin: options.trustedOrigins,
    credentials: true,
  })

  const auth = await getBetterAuth()
  if (options.autoMigrate) {
    await runBetterAuthMigrations()
  }

  // Attach a pool-level error handler so idle-connection termination events
  // (e.g. 57P01 from pg when the test database is dropped during integration
  // test cleanup) do not become unhandled EventEmitter exceptions. pg-pool
  // emits 'error' on the pool for idle clients; without a listener the process
  // would crash. We log non-expected errors and silently swallow 57P01.
  const pool = (auth as any).options?.database as
    | { on?: (ev: string, fn: (err: Error & { code?: string }) => void) => void }
    | undefined
  if (pool && typeof pool.on === "function") {
    pool.on("error", (err) => {
      if (err.code !== "57P01") {
        // 57P01 = "terminating connection due to administrator command"
        // (test DB dropped by the integration test runner — safe to ignore)
        console.error("[medusa-plugin-better-auth] pg pool idle error:", err)
      }
    })
  }

  const { toNodeHandler } = await import("better-auth/node")
  nodeHandler = toNodeHandler(auth) as (
    req: MedusaRequest,
    res: MedusaResponse
  ) => void
  return auth
})()

async function corsMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  await ready
  if (corsMiddlewareHandler) {
    return corsMiddlewareHandler(req, res, next)
  }
  return next()
}

async function betterAuthRouter(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // Les routes bridge du plugin (fichiers route.ts) prennent le relais.
  if (req.originalUrl.startsWith(BRIDGE_PREFIX)) {
    return next()
  }
  try {
    await ready
    // app.use() peut retirer le préfixe monté de req.url ; Better Auth
    // route sur le chemin complet.
    req.url = req.originalUrl
    return nodeHandler!(req, res)
  } catch (error) {
    return next(error)
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: `${BASE_PATH}/*`,
      // Indispensable : toNodeHandler lit le stream brut. Un body déjà
      // parsé par Medusa laisserait la requête suspendue.
      bodyParser: false,
      middlewares: [corsMiddleware, betterAuthRouter],
    },
  ],
})
