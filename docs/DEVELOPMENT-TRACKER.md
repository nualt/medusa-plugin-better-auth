# Development tracker

This document tracks hardening work that spans more than one commit or release.
It is not a changelog: completed user-facing changes still belong in the
release changelog.

## Status definitions

- **Implemented**: code and focused automated coverage are present.
- **Planned**: accepted work, not implemented yet.
- **Candidate**: identified during review; scope and solution still need a
  decision.

## Implemented

### Distinguish identity-not-found from provider failures

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** `BetterAuthProviderService.authenticate` treated every identity
  retrieval failure as a missing identity. A database or provider failure could
  therefore enter the customer identity creation path or show an incorrect
  admin linking error.
- **Decision:** Enter the create/link path only for a Medusa `NOT_FOUND`
  error. Propagate all other errors unchanged so infrastructure failures remain
  observable and cannot trigger writes.
- **Verification:** Unit coverage for first-time customers, unlinked admins,
  and database failures that must not create an identity.

### Serialize identity linking across backend processes

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** `ensureLinkedIdentity` used a check-then-create/update sequence.
  Concurrent requests could both observe empty actor metadata and overwrite
  each other, even though Medusa's unique provider-identity index prevents
  duplicate rows.
- **Decision:** Serialize the full read/create/update sequence per Better Auth
  identity with a transaction-scoped PostgreSQL advisory lock. The database
  releases the lock automatically on success or failure, and the lock works
  across backend processes.
- **Verification:** Unit coverage for idempotent concurrent links, conflicting
  concurrent links, lock acquisition order, and failure cleanup.

### Polish the admin Google sign-in action

- **Date:** 2026-07-02
- **Status:** Implemented
- **Change:** Add the Google brand mark, stronger button contrast, standard
  Medusa button shadow, and clearer hover/disabled states without adding a UI
  dependency or changing authentication behavior.
- **Verification:** Admin extension production build and manual visual review
  during the clean-database authentication run.

### Require an explicit OAuth callback before admin session exchange

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** Medusa logout deleted the admin session, then redirected to
  `/app/login`. The login widget detected the still-active Better Auth session
  on every page load and immediately created a new Medusa session, making
  logout ineffective.
- **Decision:** Return social sign-in to `/app/login?better-auth=1` and exchange
  the Better Auth session only when that explicit marker is present. A `useRef`
  guard prevents React Strict Mode from running the session exchange twice in
  development.
- **Unaffected flows:** Refreshing an authenticated admin route keeps the
  existing Medusa session; password login remains native; storefront customer
  authentication and the Better Auth SSO session are unchanged.
- **Verification:** Unit coverage keeps callback generation and marker
  detection aligned. Manual Google admin login, logout, and re-login remain in
  the release checklist.

### Preserve query strings through the Medusa wildcard mount

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** Medusa registers `matcher: "/better-auth/*"` with Express
  `app.use`. Express consumes the matched path into `req.baseUrl` and leaves a
  value such as `/?state=...` in `req.url`. Better Call 1.3.7 can then rebuild
  only the path and drop the OAuth `state` and `code` query parameters.
- **Decision:** Present `req.originalUrl` to the Better Auth Node handler with
  an empty `baseUrl`, then restore both Express fields after the handler
  resolves or rejects.
- **Affected flows:** OAuth callbacks, email verification, password reset,
  session queries, account queries, and any Better Auth endpoint that consumes
  query parameters.
- **Verification:** Focused unit coverage for query preservation, plain routes,
  and error restoration. Manual Google OAuth remains part of the release
  checklist.

### Provide an explicit production migration command

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** Production deploys had no dedicated way to create the Better
  Auth tables; the README recommended a temporary `autoMigrate: true` boot.
- **Decision:** Ship a `medusa-plugin-better-auth migrate` bin. The launcher
  registers ts-node when the invoking project provides one (mirroring
  `@medusajs/cli`), the command hydrates the plugin-local `configManager`
  through `configLoader`, runs the Better Auth migrations, and exits
  explicitly so the dedicated pg pool cannot keep the process alive.
- **Verification:** Unit coverage for argument handling, config-then-migrate
  ordering, and failure propagation. Manual run against the development
  database from `apps/backend` (initial and idempotent re-run).

### Define the supported Better Auth version range

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** The peer dependency accepted Better Auth `^1.3.0`, but the
  plugin imports `better-auth/db/migration`, a subpath that only exists since
  1.5.0. Installing 1.3.x or 1.4.x would fail at boot (with `autoMigrate`) or
  when running the migration command.
- **Decision:** Raise the peer dependency to `^1.5.0` (the technical floor
  imposed by the migration import, confirmed against published package
  exports) and align the dev dependency with 1.6.23, the version used for
  local verification. Documented in the README.
- **Verification:** Package exports inspected for 1.3.0–1.6.23; unit and HTTP
  integration suites run against 1.6.23.

### Match linking emails case-insensitively

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** The bridge link routes matched customers and admin users with
  an exact-case email filter, while Medusa stores emails as typed and OAuth
  providers usually return them lowercased. An admin invited as
  `Jane@Corp.com` could never link a Google identity reporting
  `jane@corp.com`.
- **Decision:** Query with a case-insensitive filter (`$ilike`, with ILIKE
  wildcards escaped so the email stays a literal) and, when several accounts
  differ only by casing, prefer the exact-case match.
- **Verification:** Unit coverage for wildcard escaping and actor selection;
  HTTP integration test linking an admin whose stored casing differs from the
  provider email.

### Distinguish technical failures from unlinked identities in the admin widget

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** Any failure during the admin session exchange (including 500s
  and network errors) showed the "no admin account is linked" invitation
  message, sending operators down the wrong path.
- **Decision:** Map only 401/403 responses to the unlinked message; all other
  failures show the generic sign-in failure notice. The failure notice also
  renders when the provider list is empty so the error is never hidden.
- **Verification:** Admin extension production build. Manual admin OAuth
  error-path review remains in the release checklist.

### Document production hardening requirements

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** Nothing told operators that Better Auth's default rate-limit
  storage is per-instance, that cross-subdomain cookies need explicit
  configuration, that the plugin adds a second pg pool per instance, or that
  `ba_session` grows unbounded. The Medusa core exchange routes also sit
  outside Better Auth's limiter.
- **Decision:** Add a "Production checklist" section to the README with
  concrete `betterAuth` passthrough configuration (shared rate-limit storage,
  strict rules on sign-in/sign-up, proxy IP headers, cross-subdomain cookies)
  plus pool sizing, session purge, proxy-level rate limiting of `/auth/*`,
  and the deploy-time migration command. No code changes: everything is
  reachable through existing passthrough options.
- **Verification:** Rate-limit and cookie defaults checked against current
  Better Auth documentation. Out-of-the-box validation on a fresh
  `create-medusa-app` template (npm tarball install, migrate CLI, boot,
  full customer and admin flows, admin widget render).

### Curated zero-config provider registry

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** OAuth provider credentials must be configured case by case in
  `medusa-config.ts`, even for the small set of commonly deployed B2C
  providers. Repetitive boilerplate hides the simpler patterns.
- **Decision:** Curate a registry of 8 B2C-friendly providers (Google, Apple,
  Facebook, Microsoft, Discord, TikTok, X, GitHub). The
  `socialProvidersFromEnv()` function scans the environment for
  `<PREFIX>_CLIENT_ID` + `<PREFIX>_CLIENT_SECRET` pairs and builds the config
  in one line. Incomplete pairs trigger an explicit boot warning; other
  providers still work via passthrough merge.
- **Verification:** Unit coverage for complete/incomplete pairs and env var
  fallback. Integration test confirms boot warning appears and provider
  registration succeeds.

### Shared brand icons with fallback

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** Login UI buttons need per-provider brand icons. Storefront and
  admin widgets would both need icon libraries or SVG lookups, leading to
  duplication and divergence.
- **Decision:** Ship `ProviderIconSpec` and `getProviderDisplay()` in the
  shared icons package. The data includes brand SVG, colors, and labels for
  all eight curated providers. UI components reference it and render a clean
  initial-letter fallback for unlisted providers.
- **Verification:** Shared icons package exports are correct. Storefront
  and admin both use the same spec and render consistently (no color or icon
  divergence).

### Lazy Better Auth plugin descriptors (CJS configs)

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** `medusa-config.ts` compiles to CommonJS, but `better-auth/plugins`
  exports are ESM-only. A static `import` in the config would crash at require
  time.
- **Decision:** Export `lazyBetterAuthPlugin(name, options)` from
  `lib/lazy-plugins`. The function returns a lightweight descriptor; the plugin
  resolves it via dynamic `import()` when building the Better Auth instance.
  Supports custom module specifiers for forked or local plugins.
- **Verification:** Unit coverage for descriptor creation, resolution success,
  missing export detection, and options passthrough. Integration test: magic
  link plugin declared lazily in `medusa-config.ts` boots successfully.

### Magic link on the storefront (Resend + dev fallback)

- **Date:** 2026-07-02
- **Status:** Implemented
- **Problem:** Passwordless workflows require email delivery. Development
  should not depend on live email services; production must use a reliable
  provider.
- **Decision:** Implement the magic link handler in `medusa-config.ts`:
  in test mode, capture links to `globalThis.__capturedMagicLinks` (for
  automated verification); in production with `RESEND_API_KEY`, send via
  Resend's API; in development without the key, log the link to console.
  Storefront form calls `authClient.signIn.magicLink()` with a
  `?better-auth=1` callback marker; the session exchange handles the rest.
  French copy throughout.
- **Verification:** Unit test confirms test-mode capture; manual storefront
  flow in dev (console link) and staging (Resend delivery) both work; release
  checklist includes magic link and provider button manual tests.

## Planned

### Extract the plugin to a standalone repository

- **Date:** 2026-07-02
- **Status:** Planned
- **Scope:** Increment 3. Use `git subtree split` to preserve history,
  initialize a clean GitHub repo with CI (tests, build, types), configure
  automated npm publication, and update nualt-shop to consume the published
  version. The shop remains the primary test bench until extraction, so
  development continues in the monorepo; after extraction, the extracted repo
  becomes the source of truth.
- **Dependencies:** All prior tasks (Tasks 1–5) must be complete and shipping.

## Candidates

None currently.

## Updating this tracker

When work starts, move the entry to **Planned** and record the chosen scope.
Move it to **Implemented** only after focused verification exists, including
the completion date and any remaining manual checks.
