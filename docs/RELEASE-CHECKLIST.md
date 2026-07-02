# Release checklist

Avant chaque publication npm :

- [ ] `pnpm --filter medusa-plugin-better-auth test:unit` — vert
- [ ] `pnpm --filter @dtc/backend test:integration:http` — vert
- [ ] E2E manuel sur nualt-shop en local :
  - [ ] Storefront : magic link (console en dev) → session active
  - [ ] Storefront : boutons providers avec logos (Google + un provider fallback factice)
  - [ ] Storefront : « Continuer avec google » → compte créé → session active
  - [ ] Storefront : reconnexion Google sur compte existant → session active
  - [ ] Admin : login Google d'un email SANS compte admin → message d'invitation, pas de session
  - [ ] Admin : login Google d'un admin invité (email vérifié) → dashboard
  - [ ] Admin : logout → reste sur `/app/login`, sans échange Better Auth automatique
  - [ ] Admin : après logout, nouveau clic Google → dashboard
  - [ ] Email/password Better Auth : sign-up storefront → échange OK
- [ ] Revoir `docs/DEVELOPMENT-TRACKER.md` : statuts à jour, aucun candidat
      devenu bloqueur de release
- [ ] `pnpm --filter medusa-plugin-better-auth build` puis inspection de `.medusa/server` (pas de fichiers parasites)
- [ ] Version bump + CHANGELOG
- [ ] `npm publish --dry-run` puis `npm publish`
