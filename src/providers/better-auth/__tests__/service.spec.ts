import { BetterAuthProviderService } from "../service"
import { MedusaError } from "@medusajs/framework/utils"

jest.mock("../../../lib/better-auth", () => ({
  getBetterAuth: jest.fn(),
}))

import { getBetterAuth } from "../../../lib/better-auth"

const mockGetBetterAuth = getBetterAuth as jest.Mock

const baSession = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: "ba-user-1",
    email: "jane@test.dev",
    emailVerified: true,
    name: "Jane Doe",
    image: null,
    ...overrides,
  },
})

const makeService = () =>
  new BetterAuthProviderService({ logger: console } as any, {} as any)

const identityService = () => ({
  retrieve: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  setState: jest.fn(),
  getState: jest.fn(),
})

const withSession = (session: unknown) => {
  mockGetBetterAuth.mockResolvedValue({
    api: { getSession: jest.fn().mockResolvedValue(session) },
  })
}

describe("BetterAuthProviderService.authenticate", () => {
  beforeEach(() => jest.resetAllMocks())

  it("fails without a Better Auth session", async () => {
    withSession(null)
    const result = await makeService().authenticate(
      { actor_type: "customer", headers: {} },
      identityService() as any
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/session/i)
  })

  it("returns the existing identity for a returning customer", async () => {
    withSession(baSession())
    const service = identityService()
    const identity = { id: "authid_1", app_metadata: { customer_id: "cus_1" } }
    service.retrieve.mockResolvedValue(identity)
    const result = await makeService().authenticate(
      { actor_type: "customer", headers: {} },
      service as any
    )
    expect(result).toEqual({ success: true, authIdentity: identity })
    expect(service.retrieve).toHaveBeenCalledWith({ entity_id: "ba-user-1" })
  })

  it("creates the identity for a first-time customer", async () => {
    withSession(baSession())
    const service = identityService()
    service.retrieve.mockRejectedValue(
      new MedusaError(MedusaError.Types.NOT_FOUND, "not found")
    )
    const created = { id: "authid_2", app_metadata: {} }
    service.create.mockResolvedValue(created)
    const result = await makeService().authenticate(
      { actor_type: "customer", headers: {} },
      service as any
    )
    expect(result).toEqual({ success: true, authIdentity: created })
    expect(service.create).toHaveBeenCalledWith({
      entity_id: "ba-user-1",
      user_metadata: {
        email: "jane@test.dev",
        email_verified: true,
        name: "Jane Doe",
        image: null,
      },
    })
  })

  it("surfaces identity provider failures instead of creating an identity", async () => {
    withSession(baSession())
    const service = identityService()
    const providerError = new MedusaError(
      MedusaError.Types.DB_ERROR,
      "database unavailable"
    )
    service.retrieve.mockRejectedValue(providerError)

    await expect(
      makeService().authenticate(
        { actor_type: "customer", headers: {} },
        service as any
      )
    ).rejects.toBe(providerError)
    expect(service.create).not.toHaveBeenCalled()
  })

  it("never creates an identity for the user (admin) actor", async () => {
    withSession(baSession())
    const service = identityService()
    service.retrieve.mockRejectedValue(
      new MedusaError(MedusaError.Types.NOT_FOUND, "not found")
    )
    const result = await makeService().authenticate(
      { actor_type: "user", headers: {} },
      service as any
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/link/i)
    expect(service.create).not.toHaveBeenCalled()
  })

  it("rejects an admin identity that is not linked to a Medusa user", async () => {
    withSession(baSession())
    const service = identityService()
    service.retrieve.mockResolvedValue({ id: "authid_3", app_metadata: {} })
    const result = await makeService().authenticate(
      { actor_type: "user", headers: {} },
      service as any
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/link/i)
  })

  it("accepts a linked admin identity", async () => {
    withSession(baSession())
    const service = identityService()
    const identity = { id: "authid_4", app_metadata: { user_id: "user_1" } }
    service.retrieve.mockResolvedValue(identity)
    const result = await makeService().authenticate(
      { actor_type: "user", headers: {} },
      service as any
    )
    expect(result).toEqual({ success: true, authIdentity: identity })
  })
})

describe("register / update", () => {
  it("register points to Better Auth flows", async () => {
    const result = await makeService().register(
      { actor_type: "customer" },
      identityService() as any
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/better-auth/i)
  })

  it("update is not supported", async () => {
    const result = await makeService().update({}, identityService() as any)
    expect(result.success).toBe(false)
  })
})
