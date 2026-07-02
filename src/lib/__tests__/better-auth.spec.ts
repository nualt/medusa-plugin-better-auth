import type { ResolvedPluginOptions } from "../types"

// Mock better-auth before importing buildBetterAuth
jest.mock("better-auth", () => {
  return {
    betterAuth: jest.fn((config: any) => {
      return {
        options: config,
        api: {
          getSession: jest.fn(),
        },
      }
    }),
  }
})

jest.mock("pg")

import { buildBetterAuth, BASE_PATH } from "../better-auth"

const resolved: ResolvedPluginOptions = {
  betterAuth: { secret: "test-secret", emailAndPassword: { enabled: true } },
  autoLink: "verified-email",
  autoMigrate: false,
  normalizeCustomerEmails: true,
  databaseUrl: "postgres://postgres:postgres@localhost/never-connected",
  trustedOrigins: ["http://localhost:8000"],
}

describe("buildBetterAuth", () => {
  it("forces the base path to /better-auth", async () => {
    const auth = await buildBetterAuth(resolved)
    expect(BASE_PATH).toEqual("/better-auth")
    expect(auth.options.basePath).toEqual(BASE_PATH)
  })

  it("prefixes core tables with ba_ by default", async () => {
    const auth = await buildBetterAuth(resolved)
    expect(auth.options.user?.modelName).toEqual("ba_user")
    expect(auth.options.session?.modelName).toEqual("ba_session")
    expect(auth.options.account?.modelName).toEqual("ba_account")
    expect(auth.options.verification?.modelName).toEqual("ba_verification")
  })

  it("lets the user override a model name", async () => {
    const auth = await buildBetterAuth({
      ...resolved,
      betterAuth: {
        ...resolved.betterAuth,
        user: { modelName: "custom_user" },
      },
    })
    expect(auth.options.user?.modelName).toEqual("custom_user")
  })

  it("merges derived trusted origins with user-provided ones", async () => {
    const auth = await buildBetterAuth({
      ...resolved,
      betterAuth: { ...resolved.betterAuth, trustedOrigins: ["https://x.dev"] },
    })
    expect(auth.options.trustedOrigins).toEqual(
      expect.arrayContaining(["http://localhost:8000", "https://x.dev"])
    )
  })

  it("exposes the server-side session API", async () => {
    const auth = await buildBetterAuth(resolved)
    expect(typeof auth.api.getSession).toBe("function")
  })
})
