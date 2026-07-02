const getPluginOptions = jest.fn(() => ({ normalizeCustomerEmails: true }))

jest.mock("../../lib/better-auth", () => ({
  getPluginOptions: () => getPluginOptions(),
}))

import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  normalizeCartEmail,
  normalizeCustomerCreationEmail,
  normalizeCustomerEmailPassLogin,
  normalizeCustomerEmailPassRegistration,
} from "../customer-email"

function request(
  body: Record<string, unknown>,
  authIdentities: Array<Record<string, unknown>> = [],
  customers: Array<Record<string, unknown>> = []
) {
  const authService = {
    listProviderIdentities: jest.fn().mockResolvedValue(authIdentities),
  }
  const customerService = {
    listCustomers: jest.fn().mockResolvedValue(customers),
  }

  return {
    req: {
      body,
      scope: {
        resolve: jest.fn((module: string) =>
          module === Modules.AUTH ? authService : customerService
        ),
      },
    } as any,
    authService,
    customerService,
  }
}

describe("customer email middlewares", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getPluginOptions.mockReturnValue({ normalizeCustomerEmails: true })
  })

  it("normalizes a new native email/password registration", async () => {
    const { req, authService, customerService } = request({
      email: "  Jane@Example.COM ",
      password: "secret",
    })
    const next = jest.fn()

    await normalizeCustomerEmailPassRegistration(req, {} as any, next)

    expect(req.body.email).toBe("jane@example.com")
    expect(authService.listProviderIdentities).toHaveBeenCalledWith({
      provider: "emailpass",
      entity_id: { $ilike: "jane@example.com" },
    })
    expect(customerService.listCustomers).toHaveBeenCalledWith({
      email: { $ilike: "jane@example.com" },
      has_account: true,
    })
    expect(next).toHaveBeenCalledWith()
  })

  it("preserves a legacy identity's stored casing during login", async () => {
    const { req } = request(
      { email: "jane@example.com", password: "secret" },
      [{ entity_id: "Jane@Example.com" }]
    )
    const next = jest.fn()

    await normalizeCustomerEmailPassLogin(req, {} as any, next)

    expect(req.body.email).toBe("Jane@Example.com")
    expect(next).toHaveBeenCalledWith()
  })

  it("rejects ambiguous legacy email/password identities", async () => {
    const { req } = request(
      { email: "jane@example.com", password: "secret" },
      [
        { entity_id: "Jane@Example.com" },
        { entity_id: "jane@example.com" },
      ]
    )
    const next = jest.fn()

    await normalizeCustomerEmailPassLogin(req, {} as any, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ type: MedusaError.Types.CONFLICT })
    )
  })

  it("blocks registration when an active customer already matches", async () => {
    const { req } = request(
      { email: "JANE@example.com", password: "secret" },
      [],
      [{ id: "cus_existing", has_account: true }]
    )
    const next = jest.fn()

    await normalizeCustomerEmailPassRegistration(req, {} as any, next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ type: MedusaError.Types.CONFLICT })
    )
  })

  it("normalizes customer creation and updates an existing validated body", async () => {
    const { req } = request({ email: "Jane@Example.com" })
    req.validatedBody = { email: "Jane@Example.com", first_name: "Jane" }
    const next = jest.fn()

    await normalizeCustomerCreationEmail(req, {} as any, next)

    expect(req.body.email).toBe("jane@example.com")
    expect(req.validatedBody.email).toBe("jane@example.com")
    expect(next).toHaveBeenCalledWith()
  })

  it("normalizes guest cart emails without looking up customer accounts", () => {
    const { req, authService, customerService } = request({
      email: "Guest@Example.com",
    })
    const next = jest.fn()

    normalizeCartEmail(req, {} as any, next)

    expect(req.body.email).toBe("guest@example.com")
    expect(authService.listProviderIdentities).not.toHaveBeenCalled()
    expect(customerService.listCustomers).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it("leaves requests untouched when normalization is disabled", async () => {
    getPluginOptions.mockReturnValue({ normalizeCustomerEmails: false })
    const { req, authService } = request({
      email: "Jane@Example.com",
      password: "secret",
    })
    const next = jest.fn()

    await normalizeCustomerEmailPassLogin(req, {} as any, next)

    expect(req.body.email).toBe("Jane@Example.com")
    expect(authService.listProviderIdentities).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })
})
