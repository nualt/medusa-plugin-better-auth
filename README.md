# medusa-plugin-better-auth

[Better Auth](https://better-auth.com) as the authentication engine for
[Medusa v2](https://medusajs.com) — social OAuth, email & password, magic
links, passkeys and optional 2FA (via Better Auth plugins) for **both customers and admin users**, without
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

## Zero-config providers

Set a pair of environment variables and the provider is live — button and
brand icon included, on both the storefront helpers and the admin login
widget:

```ts
socialProviders: socialProvidersFromEnv(),
```

| Provider | Environment variables |
| --- | --- |
| Google | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| Apple | `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` |
| Facebook | `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` |
| Microsoft | `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` |
| Discord | `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` |
| TikTok | `TIKTOK_CLIENT_ID` / `TIKTOK_CLIENT_SECRET` |
| X (Twitter) | `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` |
| GitHub | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` |

An incomplete pair (ID without SECRET) is ignored with an explicit boot
warning. Providers outside this list still work through the regular
passthrough — merge them in manually:

```ts
socialProviders: { ...socialProvidersFromEnv(), zoom: { clientId, clientSecret } },
```

The UI helpers render a clean fallback (initial-letter badge) for any
provider without a bundled brand icon.

> **Apple**: `APPLE_CLIENT_SECRET` is not a static secret but a signed JWT
> you generate from your Apple Developer `.p8` key (six-month max
> lifetime). Generate it, then treat it as a regular env var.

## Better Auth plugins from your Medusa config

`medusa-config.ts` compiles to CommonJS, but `better-auth/plugins` is
ESM-only — a static import would crash at require time. Declare plugins
lazily instead; the plugin resolves them with a dynamic import when the
Better Auth instance is built:

```ts
import { lazyBetterAuthPlugin } from "medusa-plugin-better-auth/lib/lazy-plugins"

betterAuth: {
  plugins: [
    lazyBetterAuthPlugin("magicLink", {
      sendMagicLink: async ({ email, url }) => {
        // send the email with your provider (Resend, SMTP…)
      },
    }),
  ],
}
```

The optional module specifier accepts an installed package name, an absolute
path, or a `file:` URL. Relative paths such as `./my-plugin` are rejected
because they would resolve from the plugin's compiled directory rather than
from your Medusa project. The default `better-auth/plugins` module used above
needs no extra configuration.

## Magic link (passwordless)

Full recipe: enable the plugin as above, send the email (or log the link
in dev), and point `callbackURL` at your storefront page with the
`?better-auth=1` marker — the standard session exchange handles the rest.
See the working implementation in nualt-shop
(`apps/backend/medusa-config.ts` and
`apps/storefront/src/modules/account/components/better-auth-login/`).

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `ALL /better-auth/*` | Every Better Auth flow (sign-in, callbacks, magic links…) |
| `GET /better-auth/bridge/providers` | Configured methods (`social`, `email_password`, `magic_link`), for building login UIs |
| `POST /better-auth/bridge/link/customer` | Link the session identity to an existing customer (idempotent) |
| `POST /better-auth/bridge/link/user` | Link to an existing admin user (401 if none) |
| `POST /auth/customer/better-auth` | Exchange the session for a Medusa customer token (core route) |
| `POST /auth/user/better-auth` | Exchange for an admin token (core route) |

## Storefront recipe (Next.js)

```ts
import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: `${BACKEND_URL}/better-auth`,
  fetchOptions: { credentials: "include" },
  plugins: [magicLinkClient()],
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
| `normalizeCustomerEmails` | `true` | Lowercase and trim new native Medusa customer/cart emails, resolve native `emailpass` logins case-insensitively, and reject registration when an active customer already exists with different casing. |

Secret resolution: `betterAuth.secret`, else `BETTER_AUTH_SECRET`. The
server refuses to boot without one. Caveat: in setups where the config
module isn't loaded at plugin import time (some pnpm monorepos), the
failure surfaces as a logged startup error and 500s on `/better-auth/*`
instead of a hard boot refusal. Trusted origins are derived from your
Medusa `authCors`/`storeCors`/`adminCors` and merged with any
`betterAuth.trustedOrigins` you provide.

## Customer email normalization and guest orders

With `normalizeCustomerEmails` enabled, the plugin applies one canonical email
form to native Medusa customer registration, customer creation, and guest cart
writes. Existing mixed-case `emailpass` identities remain usable: login first
resolves the stored identity case-insensitively, then authenticates against its
existing password hash.

An existing `has_account: true` customer blocks another native registration
with the same email under different casing. An existing guest customer
(`has_account: false`) does not: Medusa deliberately keeps guest and registered
customer records separate.

The plugin never merges guest orders automatically based on an email string.
After login, expose Medusa's order-transfer flow to let the customer request a
transfer (`POST /store/orders/:id/transfer/request`) and confirm it using the
token sent to the order email. This proves mailbox ownership before order data
is attached to the account.

## Production checklist

The plugin stays out of the hot path — Better Auth is only exercised at
sign-in, after which clients hold native Medusa tokens — but the
following must be configured before going live. Everything below is
standard Better Auth configuration passed through the `betterAuth`
option.

**Rate limiting across instances.** Better Auth enables its rate limiter
in production, but the default storage is in-memory, i.e. per instance.
Behind a load balancer, switch to shared storage and tighten the
sensitive endpoints:

```ts
betterAuth: {
  rateLimit: {
    storage: "database", // or "secondary-storage" with Redis
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  // Behind a proxy/CDN, tell Better Auth where the client IP lives:
  advanced: {
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },
}
```

Also rate-limit `/auth/*` at your reverse proxy: the Medusa core
exchange routes (`/auth/customer/better-auth`, `/auth/user/better-auth`)
are not covered by Better Auth's limiter and each call costs a session
lookup.

**Cross-subdomain cookies.** With a storefront on `shop.example.com`
and the API on `api.example.com`, configure
`advanced.crossSubDomainCookies = { enabled: true, domain: "example.com" }`
(and keep `useSecureCookies` on). This is the most common source of
"works locally, fails in production" reports.

**Postgres connections.** The plugin runs its own `pg` pool (default max
10 per instance) next to Medusa's. The plugin owns this database option, so it
cannot currently be tuned through `betterAuth.database`; size your database
or pooler (pgbouncer) accordingly.

**Session table growth.** Expired `ba_session` rows are not purged
eagerly; schedule a periodic cleanup
(`delete from ba_session where "expiresAt" < now()`).

**Migrations.** Keep `autoMigrate` off in production and run
`npx medusa-plugin-better-auth migrate` during deploys.

## License

MIT
