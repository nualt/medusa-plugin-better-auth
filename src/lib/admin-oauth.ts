export const ADMIN_OAUTH_CALLBACK_URL = "/app/login?better-auth=1"

export function isAdminOAuthCallback(search: string): boolean {
  return new URLSearchParams(search).get("better-auth") === "1"
}
