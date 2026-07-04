# @nualt/medusa-plugin-better-auth

[![npm version](https://img.shields.io/npm/v/@nualt/medusa-plugin-better-auth)](https://www.npmjs.com/package/@nualt/medusa-plugin-better-auth)
[![npm downloads](https://img.shields.io/npm/dw/@nualt/medusa-plugin-better-auth)](https://www.npmjs.com/package/@nualt/medusa-plugin-better-auth)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Modern authentication for [Medusa v2](https://medusajs.com), powered by
[Better Auth](https://better-auth.com), without replacing Medusa's native auth
model.

Use Better Auth for social OAuth, email/password, magic links, passkeys and
optional 2FA, while still letting Medusa issue native tokens for customers and
admin users.

## Why this exists

Medusa already has an auth module. Better Auth already handles modern
authentication flows.

The missing piece is the bridge between the two.

This plugin lets Better Auth handle sign-in, then exchanges the verified Better
Auth session for a native Medusa token for either a `customer` or an admin
`user`.

That means you can add modern auth flows without rewriting your storefront,
replacing Medusa's session model, or breaking standard Medusa protected routes.

```txt
User signs in with Better Auth
        ↓
Better Auth creates a session
        ↓
The Medusa `better-auth` provider validates that session
        ↓
Medusa issues a native customer/user token
        ↓
Your storefront, admin dashboard and protected routes keep working normally
```

## Features

- Better Auth mounted inside your Medusa server at `/better-auth/*`
- Works for both customers and admin users
- Social OAuth, email/password, magic links, passkeys and optional 2FA through
  Better Auth
- Native Medusa tokens after session exchange
- Admin dashboard login widget
- Safe admin linking: OAuth never creates admin users
- Zero-config social providers from environment variables
- Better Auth tables stored in your Medusa Postgres database
- Production migration command
- Optional customer email normalization to avoid case-duplicate accounts

## Status

This package is early but usable.

It was built from a real Medusa v2 project and is currently verified against:

- Medusa 2.17
- Better Auth 1.6.x
- Node 20+
- pnpm and yarn
- npm with the documented workaround below

The plugin requires Better Auth `>= 1.5.0`. The migration API moved to
`better-auth/db/migration` in 1.5.0.

If you hit an issue, please open a GitHub issue with your Medusa version, Better
Auth version, package manager, deployment setup and the auth flow you were
testing.

## Installation

```bash
pnpm add @nualt/medusa-plugin-better-auth better-auth
```

With npm:

```bash
npm install @nualt/medusa-plugin-better-auth better-auth --legacy-peer-deps
```

See [Installing with npm](#installing-with-npm) if you hit peer dependency or
`jose` issues.

## Quick start

Register the plugin and the Medusa auth provider in `medusa-config.ts`:

```ts
module.exports = defineConfig({
  plugins: [
    {
      resolve: "@nualt/medusa-plugin-better-auth",
      options: {
        betterAuth: {
          baseURL: process.env.BETTER_AUTH_URL,
          emailAndPassword: { enabled: true },
          socialProviders: {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            },
          },
          // Any Better Auth option or plugin works here. `database` and
          // `basePath` are managed by the plugin.
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
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          {
            resolve: "@nualt/medusa-plugin-better-auth/providers/better-auth",
            id: "better-auth",
          },
        ],
      },
    },
  ],
})
```

Set the required environment variables:

```env
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_URL=https://api.your-store.com
```

In development, Better Auth tables are created automatically at boot because
`autoMigrate` defaults to true outside production.

In production, run the migration during deploy, from the directory you start
Medusa from:

```bash
npx medusa-plugin-better-auth migrate
```

The command loads your `medusa-config`, applies the Better Auth schema
migrations to the configured database, and exits. It is idempotent, so running
it on every deploy is safe.

## How it works

Better Auth runs inside your Medusa server, mounted at `/better-auth/*`, with
its tables stored in your Medusa Postgres database using the `ba_*` prefix.

Better Auth handles the authentication flow. The plugin then provides a Medusa
auth module provider called `better-auth`.

That provider validates the Better Auth session and lets Medusa issue its own
native token for the requested actor:

- `customer` for storefront users
- `user` for admin users

Your protected routes, admin dashboard and storefront keep working with
standard Medusa auth.

Admin accounts are never created through OAuth. An OAuth identity can only be
linked to an existing invited admin user, and only when the provider has
verified the email address.

## Zero-config social providers

Set a pair of environment variables and the provider is live: button and brand
icon included, on both the storefront helpers and the admin login widget.

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
| X / Twitter | `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` |
| GitHub | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` |

An incomplete pair, such as an ID without a secret, is ignored with an explicit
boot warning.

Providers outside this list can still be configured manually through Better
Auth:

```ts
socialProviders: {
  ...socialProvidersFromEnv(),
  zoom: {
    clientId,
    clientSecret,
  },
},
```

The UI helpers render a fallback initial-letter badge for providers without a
bundled brand icon.

### Apple note

`APPLE_CLIENT_SECRET` is not a static secret. It is a signed JWT generated from
your Apple Developer `.p8` key, with a maximum lifetime of six months. Generate
it, then treat it as a regular environment variable.

## Better Auth plugins from your Medusa config

`medusa-config.ts` compiles to CommonJS, while `better-auth/plugins` is
ESM-only. A static import would crash at require time.

Use `lazyBetterAuthPlugin` instead. The plugin resolves Better Auth plugins
with a dynamic import when the Better Auth instance is built.

```ts
import { lazyBetterAuthPlugin } from "@nualt/medusa-plugin-better-auth/lib/lazy-plugins"

betterAuth: {
  plugins: [
    lazyBetterAuthPlugin("magicLink", {
      sendMagicLink: async ({ email, url }) => {
        // Send the email with Resend, SMTP, or your provider of choice.
      },
    }),
  ],
}
```

The optional module specifier accepts:

- an installed package name
- an absolute path
- a `file:` URL

Relative paths such as `./my-plugin` are rejected because they would resolve
from the plugin's compiled directory rather than from your Medusa project.

The default `better-auth/plugins` module used above needs no extra
configuration.

## Magic link

Enable the Better Auth magic link plugin with `lazyBetterAuthPlugin`, send the
email, and point `callbackURL` at your storefront page with the
`?better-auth=1` marker.

The standard session exchange handles the rest.

A working implementation is available in
[nualt-shop](https://github.com/thomassarazin/nualt-shop):

- `apps/backend/medusa-config.ts`
- `apps/storefront/src/modules/account/components/better-auth-login/`

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `ALL /better-auth/*` | Better Auth flows: sign-in, callbacks, magic links, etc. |
| `GET /better-auth/bridge/providers` | Returns configured methods for building login UIs |
| `POST /better-auth/bridge/link/customer` | Links the current Better Auth identity to an existing customer |
| `POST /better-auth/bridge/link/user` | Links the current Better Auth identity to an existing admin user; returns 401 if none exists |
| `POST /auth/customer/better-auth` | Exchanges the Better Auth session for a Medusa customer token |
| `POST /auth/user/better-auth` | Exchanges the Better Auth session for a Medusa admin token |

## Storefront recipe

Create a Better Auth client pointing at your Medusa backend:

```ts
import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: `${BACKEND_URL}/better-auth`,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [magicLinkClient()],
})
```

Sign in with any Better Auth flow, then exchange the session for a Medusa token:

```txt
1. POST /better-auth/bridge/link/customer
2. POST /auth/customer/better-auth -> { token }
3. First login only: POST /store/customers with the token, then POST /auth/token/refresh
4. Use the final token like any Medusa customer JWT
```

The storefront and backend must share a registrable domain, for example:

```txt
shop.example.com
api.example.com
```

That allows the browser to send the Better Auth session cookie cross-origin.

Exchange calls must run in the browser with `credentials: "include"`, not from a
server runtime.

The storefront origin must also be included in Medusa's `AUTH_CORS` environment
variable, because the exchange routes live under `/auth/*` and are gated by that
policy.

A complete implementation is available in
[nualt-shop](https://github.com/thomassarazin/nualt-shop):

```txt
apps/storefront/src/lib/better-auth/
```

Ongoing hardening work and proposed follow-ups are recorded in the
[development tracker](docs/DEVELOPMENT-TRACKER.md).

## Admin dashboard

The plugin ships a `login.before` widget.

Social buttons appear above the password form automatically for every configured
social provider.

Admin linking is intentionally strict:

- the admin user must already exist in Medusa
- the admin must have been invited normally
- the OAuth provider must have verified the email address
- OAuth never creates admin users

## Options

| Option | Default | Description |
| --- | --- | --- |
| `betterAuth` | required | Passthrough Better Auth config. `database` and `basePath` are managed by the plugin. Core table names default to `ba_user`, `ba_session`, `ba_account`, `ba_verification`. |
| `autoLink` | `"verified-email"` | Controls automatic identity linking for customers only. `"verified-email"` links when the provider verified the email. `"never"` disables automatic linking. |
| `autoMigrate` | `NODE_ENV !== "production"` | Runs Better Auth schema migrations at boot. Keep this off in production. |
| `normalizeCustomerEmails` | `true` | Lowercases and trims new native Medusa customer/cart emails, resolves native `emailpass` logins case-insensitively, and rejects registration when an active customer already exists with different casing. |

Admin linking is always explicit. An invited admin user must exist and the
provider must have verified the email. `autoLink` has no effect on the admin
`link/user` route.

Secret resolution order:

```txt
betterAuth.secret
BETTER_AUTH_SECRET
```

The server refuses to boot without a secret when the plugin can resolve options
normally.

Caveat: in setups where the config module is not loaded at plugin import time,
such as some pnpm monorepos, the failure may surface as a logged startup error
and errors on `/better-auth/*` instead of a hard boot refusal.

A missing secret breaks email normalization too, because it needs the resolved
options.

Failures during Better Auth's own initialization after options resolved, such as
the npm `jose` issue below, are scoped to `/better-auth/*` only. Email
normalization and native Medusa customer/cart/emailpass flows keep working.

Trusted origins are derived from your Medusa `authCors`, `storeCors` and
`adminCors`, then merged with any `betterAuth.trustedOrigins` values you
provide.

## Customer email normalization and guest orders

> **Heads up — this touches core Medusa routes.** With
> `normalizeCustomerEmails` enabled, the plugin attaches middlewares to core
> Medusa routes to canonicalize customer emails. This is the only place where
> the plugin reaches outside `/better-auth/*`.

This affects:

- `POST /auth/customer/emailpass`
- `POST /auth/customer/emailpass/register`
- `POST /store/customers`
- cart routes that write customer emails

It exists because case-duplicate accounts are a real-world footgun.

Disable it if you want to keep Medusa's native case-sensitive behavior:

```ts
normalizeCustomerEmails: false,
```

With `normalizeCustomerEmails` enabled, the plugin applies one canonical email
form to native Medusa customer registration, customer creation and guest cart
writes.

Existing mixed-case `emailpass` identities remain usable. Login first resolves
the stored identity case-insensitively, then authenticates against its existing
password hash.

An existing `has_account: true` customer blocks another native registration
with the same email under different casing.

An existing guest customer, where `has_account: false`, does not block
registration. Medusa deliberately keeps guest and registered customer records
separate.

The plugin never merges guest orders automatically based on an email string.

After login, expose Medusa's order-transfer flow to let the customer request a
transfer:

```txt
POST /store/orders/:id/transfer/request
```

The customer then confirms the transfer using the token sent to the order email.
This proves mailbox ownership before order data is attached to the account.

## Production checklist

The plugin stays out of the hot path.

Better Auth is used during sign-in. After that, clients hold native Medusa
tokens.

Still, you should configure the following before going live.

### Run migrations during deploy

Keep `autoMigrate` off in production and run:

```bash
npx medusa-plugin-better-auth migrate
```

### Configure rate limiting across instances

Better Auth enables rate limiting in production, but the default storage is
in-memory and therefore per instance.

Behind a load balancer, switch to shared storage:

```ts
betterAuth: {
  rateLimit: {
    storage: "database", // or "secondary-storage" with Redis
    customRules: {
      "/sign-in/email": {
        window: 10,
        max: 3,
      },
      "/sign-up/email": {
        window: 60,
        max: 5,
      },
    },
  },
  // Behind a proxy/CDN, tell Better Auth where the client IP lives.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip"],
    },
  },
}
```

Also rate-limit `/auth/*` at your reverse proxy.

The Medusa exchange routes, such as `/auth/customer/better-auth` and
`/auth/user/better-auth`, are not covered by Better Auth's rate limiter, and
each exchange call costs a session lookup.

### Configure cross-subdomain cookies

For a storefront on `shop.example.com` and an API on `api.example.com`,
configure:

```ts
betterAuth: {
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: "example.com",
    },
  },
}
```

Keep secure cookies enabled in production.

Cross-subdomain cookies are a common source of "works locally, fails in
production" issues.

### Watch Postgres connections

The plugin runs its own `pg` pool next to Medusa's. The default max is 10 per
instance.

The plugin owns this database option, so it cannot currently be tuned through
`betterAuth.database`.

Size your database or pooler accordingly.

### Clean expired sessions

Expired `ba_session` rows are not purged eagerly.

Schedule a periodic cleanup:

```sql
delete from ba_session where "expiresAt" < now();
```

## Installing with npm

pnpm and yarn install this plugin without friction.

npm's flat hoisting and strict peer resolution may require two extra steps. This
has been verified on the official `create-medusa-app` monorepo template with
Medusa 2.17.

### Peer conflict at install

Better Auth ships an optional peer chain, `@lynx-js/react`, that pins
`@types/react@^18`, conflicting with the template's React 19.

Use:

```bash
npm install @nualt/medusa-plugin-better-auth better-auth --legacy-peer-deps
```

### `jose` version clash at runtime

If an older `jose` version ends up hoisted at the workspace root, Better Auth
OAuth can crash with:

```txt
The requested module 'jose' does not provide an export named 'customFetch'
```

This only appears once a social provider is configured, which can make it look
like a provider bug.

Fix it by deleting `node_modules` and `package-lock.json`, then reinstalling.

You can also add this to the root `package.json`:

```json
{
  "overrides": {
    "better-auth": {
      "jose": "^6.1.0"
    },
    "@better-auth/core": {
      "jose": "^6.1.0"
    }
  }
}
```

The plugin detects the `jose` crash at boot and prints this remedy.

In an npm workspaces monorepo, install the plugin from the workspace root.
Medusa's module resolver looks up the auth provider from the root
`node_modules`.

## License

MIT
