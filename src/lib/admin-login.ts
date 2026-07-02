export type AdminLoginResult =
  | "done"
  | "no-session"
  | "unlinked"
  | "failed"

export type AdminLoginRequest = (
  input: string,
  init?: RequestInit
) => Promise<any>

/**
 * Exchanges a Better Auth session for a native Medusa admin session.
 * A successful session lookup returning no user is the only "no-session"
 * case; transport, parsing, and server failures remain visible as failures.
 */
export async function completeAdminLogin(
  request: AdminLoginRequest,
  redirect: (url: string) => void
): Promise<AdminLoginResult> {
  let session: { user?: unknown } | null
  try {
    session = await request("/better-auth/get-session")
  } catch {
    return "failed"
  }

  if (!session?.user) return "no-session"

  try {
    await request("/better-auth/bridge/link/user", { method: "POST" })
    const { token } = await request("/auth/user/better-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    await request("/auth/session", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    })
  } catch (error) {
    const status = (error as { status?: number }).status
    return status === 401 || status === 403 ? "unlinked" : "failed"
  }

  redirect("/app")
  return "done"
}
