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
import { withFullRequestUrl } from "../lib/node-request-url"
import {
  normalizeCartEmail,
  normalizeCustomerCreationEmail,
  normalizeCustomerEmailPassLogin,
  normalizeCustomerEmailPassRegistration,
} from "./customer-email"

const BRIDGE_PREFIX = `${BASE_PATH}/bridge`

// toNodeHandler is ESM-only (better-auth/node exports only .mjs).
// We store the handler inside the ready promise to avoid a static import
// that would break the CJS build produced by medusa plugin:build.
let nodeHandler:
  | ((req: MedusaRequest, res: MedusaResponse) => void | Promise<void>)
  | null = null
let corsMiddlewareHandler: ReturnType<typeof cors> | null = null

// Attempt fail-fast at import time: when configManager is already populated
// (production boot or integration tests), validate plugin options now so a
// bad config throws before any request arrives.
// Under pnpm monorepos, each package resolves its own copy of configManager
// (peer-dependency hash differs between the plugin and the backend), so this
// singleton may be empty at import time — in that case we defer validation to
// the ready IIFE below where configLoader() is called first.
if (configManager.config?.projectConfig?.databaseUrl) {
  getPluginOptions() // throws immediately if options are invalid
}

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
// Hydrate the plugin-local configManager singleton (if needed) and resolve
// plugin options. Extracted so both `optionsReady` (used by the core-route
// normalization middlewares, which only ever need getPluginOptions()) and
// `ready` (the full Better Auth init, used by /better-auth/*) share the same
// config-loading path instead of duplicating it.
async function loadPluginOptions() {
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
  return getPluginOptions()
}

// Options-only readiness gate for the core-route normalization middlewares
// (emailpass, /store/customers, /store/carts). These never touch the Better
// Auth instance itself — they only resolve Medusa modules from req.scope —
// so they must not be coupled to the full `ready` init below. If Better Auth
// fails to initialise (e.g. the documented jose@4 npm hoisting issue), guest
// checkout and native customer/cart writes must keep working.
const optionsReady: Promise<ReturnType<typeof getPluginOptions>> =
  loadPluginOptions()

// This is an async IIFE so that the resolved options and the Better Auth
// instance are both ready before the first request is processed.
// Any bad configuration (missing secret, unknown plugin) surfaces here and
// propagates to the first request via betterAuthRouter's try/catch.
const ready: Promise<BetterAuthInstance> = (async () => {
  const options = await optionsReady

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
  ) => void | Promise<void>
  return auth
})()

// Log one loud, actionable error at boot so operators can diagnose the root
// cause instead of seeing opaque 500s on the first /better-auth/* request.
ready.catch((err) => {
  console.error(
    "[medusa-plugin-better-auth] Initialisation failed — all /better-auth/* requests will return errors. Root cause:",
    err
  )
  // npm flat-hoisting can leave an old `jose` at the workspace root while
  // @better-auth/core needs ^6 — the crash only appears once a social
  // provider is configured (the OAuth module is loaded lazily). Print the
  // known remedy instead of leaving operators with a bare SyntaxError.
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes("jose") && message.includes("customFetch")) {
    console.error(
      `[medusa-plugin-better-auth] This is a known npm dependency-tree issue: an outdated "jose" package is hoisted at your workspace root while Better Auth requires jose@^6.
Fix: regenerate your lockfile — delete node_modules and package-lock.json, then reinstall (npm install --legacy-peer-deps). As a belt-and-braces measure, add to your root package.json:
  "overrides": { "better-auth": { "jose": "^6.1.0" }, "@better-auth/core": { "jose": "^6.1.0" } }
pnpm and yarn are not affected. See the plugin README, section "Installing with npm".`
    )
  }
})

async function corsMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    await ready
    if (corsMiddlewareHandler) {
      return corsMiddlewareHandler(req, res, next)
    }
    return next()
  } catch (error) {
    return next(error)
  }
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
    return await withFullRequestUrl(req, () => nodeHandler!(req, res))
  } catch (error) {
    return next(error)
  }
}

// Core-route gate: awaits only `optionsReady`, never the full Better Auth
// `ready` init. This decouples cart/customer/emailpass normalization from
// Better Auth init failures (e.g. jose@4 npm hoisting) — those routes only
// resolve Medusa modules from req.scope and never touch the Better Auth
// instance.
async function waitForPluginOptions(
  _req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    await optionsReady
    return next()
  } catch (error) {
    return next(error)
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/auth/customer/emailpass/register",
      methods: ["POST"],
      middlewares: [
        waitForPluginOptions,
        normalizeCustomerEmailPassRegistration,
      ],
    },
    {
      matcher: "/auth/customer/emailpass",
      methods: ["POST"],
      middlewares: [waitForPluginOptions, normalizeCustomerEmailPassLogin],
    },
    {
      matcher: "/store/customers",
      methods: ["POST"],
      middlewares: [waitForPluginOptions, normalizeCustomerCreationEmail],
    },
    {
      matcher: "/store/carts",
      methods: ["POST"],
      middlewares: [waitForPluginOptions, normalizeCartEmail],
    },
    {
      matcher: "/store/carts/:id",
      methods: ["POST"],
      middlewares: [waitForPluginOptions, normalizeCartEmail],
    },
    {
      matcher: `${BASE_PATH}/*`,
      // Indispensable : toNodeHandler lit le stream brut. Un body déjà
      // parsé par Medusa laisserait la requête suspendue.
      bodyParser: false,
      middlewares: [corsMiddleware, betterAuthRouter],
    },
  ],
})
