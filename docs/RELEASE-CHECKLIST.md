# Release checklist

Avant chaque publication npm :

- [ ] `pnpm --filter medusa-plugin-better-auth test:unit` — vert
- [ ] `pnpm --filter @dtc/backend test:integration:http` — vert
- [ ] E2E manuel sur nualt-shop en local :
  - [ ] Storefront : « Continuer avec google » → compte créé → session active
  - [ ] Storefront : reconnexion Google sur compte existant → session active
  - [ ] Admin : login Google d'un email SANS compte admin → message d'invitation, pas de session
  - [ ] Admin : login Google d'un admin invité (email vérifié) → dashboard
  - [ ] Email/password Better Auth : sign-up storefront → échange OK
- [ ] `pnpm --filter medusa-plugin-better-auth build` puis inspection de `.medusa/server` (pas de fichiers parasites)
- [ ] Version bump + CHANGELOG
- [ ] `npm publish --dry-run` puis `npm publish`
