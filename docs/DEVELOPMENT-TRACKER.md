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

## Planned

No additional work has been accepted yet.

## Candidates

### P2 — Provide an explicit production migration command

Document and expose a deploy-safe migration workflow instead of recommending a
temporary `autoMigrate: true` production boot.

### P2 — Define the supported Better Auth version range

The peer dependency currently accepts Better Auth `^1.3.0`, while local
verification uses 1.6.23. Add a compatibility test matrix or raise the minimum
supported version to the oldest version covered by CI.

## Updating this tracker

When work starts, move the entry to **Planned** and record the chosen scope.
Move it to **Implemented** only after focused verification exists, including
the completion date and any remaining manual checks.
