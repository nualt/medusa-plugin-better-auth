import { withFullRequestUrl } from "../node-request-url"

describe("withFullRequestUrl", () => {
  it("preserves the complete path and query for a wildcard-mounted handler", async () => {
    const req = {
      baseUrl: "/better-auth/callback/google",
      url: "/?state=oauth-state&code=oauth-code",
      originalUrl:
        "/better-auth/callback/google?state=oauth-state&code=oauth-code",
    }

    const result = await withFullRequestUrl(req, () => {
      expect(req.baseUrl).toBe("")
      expect(req.url).toBe(req.originalUrl)
      return "handled"
    })

    expect(result).toBe("handled")
    expect(req.baseUrl).toBe("/better-auth/callback/google")
    expect(req.url).toBe("/?state=oauth-state&code=oauth-code")
  })

  it("preserves routes without a query string", async () => {
    const req = {
      baseUrl: "/better-auth/ok",
      url: "/",
      originalUrl: "/better-auth/ok",
    }

    await withFullRequestUrl(req, () => {
      expect(req.baseUrl).toBe("")
      expect(req.url).toBe("/better-auth/ok")
    })

    expect(req.baseUrl).toBe("/better-auth/ok")
    expect(req.url).toBe("/")
  })

  it("restores the Express URL when the handler fails", async () => {
    const req = {
      baseUrl: "/better-auth/callback/google",
      url: "/?state=oauth-state",
      originalUrl: "/better-auth/callback/google?state=oauth-state",
    }

    await expect(
      withFullRequestUrl(req, async () => {
        throw new Error("handler failed")
      })
    ).rejects.toThrow("handler failed")

    expect(req.baseUrl).toBe("/better-auth/callback/google")
    expect(req.url).toBe("/?state=oauth-state")
  })
})
