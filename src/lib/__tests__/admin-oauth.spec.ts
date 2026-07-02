import {
  ADMIN_OAUTH_CALLBACK_URL,
  isAdminOAuthCallback,
} from "../admin-oauth"

describe("admin OAuth callback marker", () => {
  it("recognizes an explicit Better Auth callback", () => {
    expect(isAdminOAuthCallback("?better-auth=1")).toBe(true)
    expect(isAdminOAuthCallback("?next=%2Fapp&better-auth=1")).toBe(true)
  })

  it("does not treat an ordinary login page as an OAuth callback", () => {
    expect(isAdminOAuthCallback("")).toBe(false)
    expect(isAdminOAuthCallback("?better-auth=0")).toBe(false)
    expect(isAdminOAuthCallback("?next=%2Fapp")).toBe(false)
  })

  it("keeps the sign-in callback and detection marker in sync", () => {
    const search = new URL(ADMIN_OAUTH_CALLBACK_URL, "http://localhost").search
    expect(isAdminOAuthCallback(search)).toBe(true)
  })
})
