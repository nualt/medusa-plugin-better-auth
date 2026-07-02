import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useRef, useState } from "react"
import {
  ADMIN_OAUTH_CALLBACK_URL,
  isAdminOAuthCallback,
} from "../../lib/admin-oauth"
import { completeAdminLogin } from "../../lib/admin-login"
import { getProviderDisplay, ProviderIcon } from "./provider-icons"

const BASE = "/better-auth"

type Status = "checking" | "idle" | "exchanging" | "unlinked" | "failed"

async function fetchJson(input: string, init?: RequestInit) {
  const res = await fetch(input, { credentials: "include", ...init })
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status })
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

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

    completeAdminLogin(fetchJson, (url) => {
      window.location.href = url
    })
      .then((result) => {
        if (result === "unlinked") setStatus("unlinked")
        else if (result === "failed") setStatus("failed")
        else if (result === "no-session") setStatus("idle")
        // "done" : la page est en cours de redirection.
      })
      .catch(() => setStatus("failed"))
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

  if (providers.length === 0 && status !== "unlinked" && status !== "failed") {
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
          <ProviderIcon provider={provider} />
          <span>Continue with {getProviderDisplay(provider).label}</span>
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
