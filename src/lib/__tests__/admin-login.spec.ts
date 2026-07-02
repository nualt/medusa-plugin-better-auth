import { completeAdminLogin } from "../admin-login"

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

describe("completeAdminLogin", () => {
  it("returns no-session only for a successful empty session response", async () => {
    const request = jest.fn().mockResolvedValue(null)

    await expect(completeAdminLogin(request, jest.fn())).resolves.toBe(
      "no-session"
    )
  })

  it("surfaces a session lookup failure as a technical failure", async () => {
    const request = jest.fn().mockRejectedValue(httpError(500))

    await expect(completeAdminLogin(request, jest.fn())).resolves.toBe(
      "failed"
    )
  })

  it("classifies an authorization refusal as an unlinked identity", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ user: { id: "ba-user-1" } })
      .mockRejectedValueOnce(httpError(401))

    await expect(completeAdminLogin(request, jest.fn())).resolves.toBe(
      "unlinked"
    )
  })

  it("classifies an exchange server error as a technical failure", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ user: { id: "ba-user-1" } })
      .mockRejectedValueOnce(httpError(500))

    await expect(completeAdminLogin(request, jest.fn())).resolves.toBe(
      "failed"
    )
  })

  it("creates the Medusa session and redirects after a successful exchange", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ user: { id: "ba-user-1" } })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ token: "medusa-token" })
      .mockResolvedValueOnce(null)
    const redirect = jest.fn()

    await expect(completeAdminLogin(request, redirect)).resolves.toBe("done")
    expect(request).toHaveBeenNthCalledWith(4, "/auth/session", {
      method: "POST",
      headers: { authorization: "Bearer medusa-token" },
    })
    expect(redirect).toHaveBeenCalledWith("/app")
  })
})
