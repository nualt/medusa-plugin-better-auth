import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useState } from "react"

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

const BetterAuthLoginWidget = () => {
  const [providers, setProviders] = useState<string[]>([])
  const [status, setStatus] = useState<Status>("checking")

  useEffect(() => {
    fetchJson(`${BASE}/bridge/providers`)
      .then((data) => setProviders(data?.social ?? []))
      .catch(() => setProviders([]))

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
        body: JSON.stringify({ provider, callbackURL: "/app/login" }),
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
          className="bg-ui-button-neutral hover:bg-ui-button-neutral-hover border-ui-border-base text-ui-fg-base w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        >
          Continue with {PROVIDER_LABELS[provider] ?? provider}
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
