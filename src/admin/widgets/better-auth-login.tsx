import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useRef, useState } from "react"
import {
  ADMIN_OAUTH_CALLBACK_URL,
  isAdminOAuthCallback,
} from "../../lib/admin-oauth"

const BASE = "/better-auth"

type Status = "checking" | "idle" | "exchanging" | "unlinked" | "failed"

async function fetchJson(input: string, init?: RequestInit) {
  const res = await fetch(input, { credentials: "include", ...init })
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status })
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/**
 * Si une session Better Auth existe (retour d'OAuth), l'échange contre
 * une session admin Medusa : link → token → session cookie → /app.
 */
async function completeAdminLogin(): Promise<"done" | "no-session" | "unlinked"> {
  let session: { user?: unknown } | null = null
  try {
    session = await fetchJson(`${BASE}/get-session`)
  } catch {
    return "no-session"
  }
  if (!session?.user) return "no-session"

  try {
    await fetchJson(`${BASE}/bridge/link/user`, { method: "POST" })
    const { token } = await fetchJson(`/auth/user/better-auth`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    await fetchJson(`/auth/session`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    })
  } catch {
    return "unlinked"
  }
  window.location.href = "/app"
  return "done"
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
  apple: "Apple",
  facebook: "Facebook",
  microsoft: "Microsoft",
}

const GoogleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 18 18"
    className="size-4 shrink-0"
  >
    <path
      fill="#4285F4"
      d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.259h2.909c1.702-1.567 2.684-3.875 2.684-6.616Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.91-2.258c-.805.54-1.835.86-3.046.86-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
    />
    <path
      fill="#FBBC05"
      d="M3.963 10.708A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.281-1.708V4.96H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.04l3.007-2.332Z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.322 0 2.508.455 3.442 1.346l2.582-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.96l3.007 2.332C4.672 5.163 6.656 3.58 9 3.58Z"
    />
  </svg>
)

const BetterAuthLoginWidget = () => {
  const [providers, setProviders] = useState<string[]>([])
  const [status, setStatus] = useState<Status>("checking")
  const effectStarted = useRef(false)

  useEffect(() => {
    // React Strict Mode re-runs effects in development. The exchange creates a
    // Medusa session, so it must run once per mounted login page.
    if (effectStarted.current) return
    effectStarted.current = true

    fetchJson(`${BASE}/bridge/providers`)
      .then((data) => setProviders(data?.social ?? []))
      .catch(() => setProviders([]))

    // An ordinary visit to /app/login includes Medusa logout redirects. Only
    // an explicit Better Auth callback may exchange the still-active SSO
    // session for a new Medusa admin session.
    if (!isAdminOAuthCallback(window.location.search)) {
      setStatus("idle")
      return
    }

    completeAdminLogin()
      .then((result) => {
        if (result === "unlinked") setStatus("unlinked")
        else if (result === "no-session") setStatus("idle")
        // "done" : la page est en cours de redirection.
      })
      .catch(() => setStatus("idle"))
  }, [])

  const signIn = async (provider: string) => {
    setStatus("exchanging")
    try {
      const data = await fetchJson(`${BASE}/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          callbackURL: ADMIN_OAUTH_CALLBACK_URL,
        }),
      })
      if (data?.url) {
        window.location.href = data.url
        return
      }
      setStatus("failed")
    } catch {
      setStatus("failed")
    }
  }

  if (providers.length === 0 && status !== "unlinked") {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-y-2">
      {status === "unlinked" && (
        <p className="text-ui-fg-error text-center text-sm">
          No admin account is linked to this identity. Ask an administrator
          for an invitation, then sign in again.
        </p>
      )}
      {status === "failed" && (
        <p className="text-ui-fg-error text-center text-sm">
          Sign-in failed. Try again or use your password below.
        </p>
      )}
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          disabled={status === "checking" || status === "exchanging"}
          onClick={() => signIn(provider)}
          className="bg-ui-bg-base hover:bg-ui-bg-base-hover border-ui-border-strong text-ui-fg-base shadow-buttons-neutral flex w-full items-center justify-center gap-x-2.5 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {provider === "google" && <GoogleIcon />}
          <span>Continue with {PROVIDER_LABELS[provider] ?? provider}</span>
        </button>
      ))}
      <div className="text-ui-fg-muted flex items-center gap-x-2 text-xs">
        <span className="bg-ui-border-base h-px flex-1" />
        or
        <span className="bg-ui-border-base h-px flex-1" />
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "login.before",
})

export default BetterAuthLoginWidget
