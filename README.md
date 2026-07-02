# medusa-plugin-better-auth

[Better Auth](https://better-auth.com) as the authentication engine for
[Medusa v2](https://medusajs.com) — social OAuth, email & password, magic
links, passkeys and 2FA for **both customers and admin users**, without
touching Medusa's native session model.

## How it works

Better Auth runs inside your Medusa server, mounted at `/better-auth/*`,
with its tables (`ba_*`) in your Medusa Postgres. It handles every
authentication flow. A Medusa auth module provider (`better-auth`) then
bridges the result: it validates the Better Auth session and lets Medusa
issue its own native tokens for the requested actor (`customer` or
`user`). Your protected routes, the admin dashboard and your storefront
keep working with standard Medusa auth.

Admin accounts are **never** created through OAuth: an identity is only
linked to an *existing* invited admin user, and only when the provider
verified the email.

## Installation

```bash
pnpm add medusa-plugin-better-auth better-auth
```

1. Register the plugin and the auth provider in `medusa-config.ts`:

```ts
module.exports = defineConfig({
  // …
  plugins: [
    {
      resolve: "medusa-plugin-better-auth",
      options: {
        betterAuth: {
          baseURL: process.env.BETTER_AUTH_URL, // public URL of this server
          emailAndPassword: { enabled: true },
          socialProviders: {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            },
          },
          // Any Better Auth option or plugin works here (magic link,
          // passkey, 2FA, genericOAuth…). `database` and `basePath`
          // are managed by the plugin.
        },
        // autoLink: "verified-email" (default) | "never"
      },
    },
  ],
  modules: [
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          { resolve: "@medusajs/medusa/auth-emailpass", id: "emailpass" },
          {
            resolve: "medusa-plugin-better-auth/providers/better-auth",
            id: "better-auth",
          },
        ],
      },
    },
  ],
})
```

2. Set the environment variables:

```
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_URL=https://api.your-store.com
```

3. Create the Better Auth tables. In development the plugin migrates
   automatically at boot (`autoMigrate` defaults to true outside
   production). For production, run the migration during your deploy,
   from the directory you start Medusa from:

```bash
npx medusa-plugin-better-auth migrate
```

The command loads your `medusa-config`, applies the Better Auth schema
migrations to the configured database, and exits. It is idempotent, so
running it on every deploy is safe.

The plugin requires Better Auth `>= 1.5.0` (the migration API moved to
`better-auth/db/migration` in 1.5.0); it is verified against 1.6.x.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `ALL /better-auth/*` | Every Better Auth flow (sign-in, callbacks, magic links…) |
| `GET /better-auth/bridge/providers` | Configured methods, for building login UIs |
| `POST /better-auth/bridge/link/customer` | Link the session identity to an existing customer (idempotent) |
| `POST /better-auth/bridge/link/user` | Link to an existing admin user (401 if none) |
| `POST /auth/customer/better-auth` | Exchange the session for a Medusa customer token (core route) |
| `POST /auth/user/better-auth` | Exchange for an admin token (core route) |

## Storefront recipe (Next.js)

```ts
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: `${BACKEND_URL}/better-auth`,
  fetchOptions: { credentials: "include" },
})
```

Sign in with any Better Auth flow, then exchange the session:

1. `POST /better-auth/bridge/link/customer`
2. `POST /auth/customer/better-auth` → `{ token }`
3. First login only: `POST /store/customers` with the token, then
   `POST /auth/token/refresh`
4. Use the final token like any Medusa customer JWT.

The storefront and backend must share a registrable domain (e.g.
`shop.example.com` / `api.example.com`) so the browser sends the Better
Auth session cookie cross-origin. Exchange calls must run in the browser
(`credentials: "include"`), not from a server runtime. The storefront
origin must also be included in Medusa's `AUTH_CORS` env var because the
core exchange routes (`/auth/customer/better-auth`, `/auth/token/refresh`)
live under `/auth/*` and are gated by that policy.

See a complete implementation in
[nualt-shop](https://github.com/thomassarazin/nualt-shop)
(`apps/storefront/src/lib/better-auth/`).

Ongoing hardening work and proposed follow-ups are recorded in the
[development tracker](docs/DEVELOPMENT-TRACKER.md).

## Admin dashboard

The plugin ships a `login.before` widget: social buttons appear above the
password form automatically for every configured social provider. Linking
rules: the email must be verified by the provider and belong to an
existing invited admin user.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `betterAuth` | — (required) | Passthrough Better Auth config. `database` and `basePath` are managed by the plugin; core table names default to `ba_user`, `ba_session`, `ba_account`, `ba_verification`. |
| `autoLink` | `"verified-email"` | Controls automatic identity linking for **customers** only: `"verified-email"` links when the provider verified the email; `"never"` never links automatically. Admin linking is always explicit — an invited admin user must exist and the provider must have verified the email; `autoLink` has no effect on the `link/user` route. |
| `autoMigrate` | `NODE_ENV !== "production"` | Run Better Auth schema migrations at boot. |

Secret resolution: `betterAuth.secret`, else `BETTER_AUTH_SECRET`. The
server refuses to boot without one. Caveat: in setups where the config
module isn't loaded at plugin import time (some pnpm monorepos), the
failure surfaces as a logged startup error and 500s on `/better-auth/*`
instead of a hard boot refusal. Trusted origins are derived from your
Medusa `authCors`/`storeCors`/`adminCors` and merged with any
`betterAuth.trustedOrigins` you provide.

## License

MIT
