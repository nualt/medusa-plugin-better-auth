jest.mock("@medusajs/framework/config", () => ({
  configManager: {
    config: { projectConfig: { databaseUrl: "postgres://test" } },
  },
  configLoader: jest.fn(),
}))

jest.mock("../../lib/better-auth", () => ({
  BASE_PATH: "/better-auth",
  getPluginOptions: jest.fn(() => ({
    trustedOrigins: [],
    autoMigrate: false,
    normalizeCustomerEmails: true,
    betterAuth: {},
  })),
  getBetterAuth: jest.fn(() =>
    Promise.reject(new Error("BA init failed: jose customFetch"))
  ),
  runBetterAuthMigrations: jest.fn(),
}))

import middlewares from "../middlewares"
import * as betterAuthLib from "../../lib/better-auth"

const mockGetPluginOptions = betterAuthLib.getPluginOptions as jest.Mock
const mockGetBetterAuth = betterAuthLib.getBetterAuth as jest.Mock

function findRoute(matcher: string) {
  const route = middlewares.routes.find((r) => r.matcher === matcher)
  if (!route) {
    throw new Error(`no route registered for matcher ${matcher}`)
  }
  return route
}

describe("core-route normalization isolation from Better Auth init", () => {
  it.each([
    "/auth/customer/emailpass/register",
    "/auth/customer/emailpass",
    "/store/customers",
    "/store/carts",
    "/store/carts/:id",
  ])(
    "lets %s proceed even when the full Better Auth init rejects",
    async (matcher) => {
      const route = findRoute(matcher)
      const [waitForPluginOptions] = route.middlewares as Array<
        (req: any, res: any, next: (err?: unknown) => void) => Promise<void>
      >
      const next = jest.fn()
      const callsBefore = mockGetBetterAuth.mock.calls.length

      await waitForPluginOptions({} as any, {} as any, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(next).toHaveBeenCalledWith()
      // The BA init promise ("ready") was already kicked off at module load
      // (and already rejected) independently of this call — what matters is
      // that waiting for plugin *options* never triggers a *new* getBetterAuth
      // call and still resolves the middleware chain.
      expect(mockGetBetterAuth.mock.calls.length).toBe(callsBefore)
      expect(mockGetPluginOptions).toHaveBeenCalled()
    }
  )

  it("still surfaces the Better Auth init failure on /better-auth/* routes", async () => {
    const route = findRoute("/better-auth/*")
    const [, betterAuthRouter] = route.middlewares as Array<
      (req: any, res: any, next: (err?: unknown) => void) => Promise<void>
    >
    const next = jest.fn()

    await betterAuthRouter(
      { originalUrl: "/better-auth/sign-in" } as any,
      {} as any,
      next
    )

    expect(next).toHaveBeenCalledTimes(1)
    const [error] = next.mock.calls[0]
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain("BA init failed")
  })
})
