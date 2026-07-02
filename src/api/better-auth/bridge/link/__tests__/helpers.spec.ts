import {
  caseInsensitiveEmailFilter,
  ensureLinkedIdentity,
  pickActorByEmail,
  type BridgeSessionUser,
} from "../helpers"
import type { PostgresAdvisoryLockConnection } from "../../../../../lib/postgres-advisory-lock"

const baUser: BridgeSessionUser = {
  id: "ba-user-1",
  email: "jane@test.dev",
  emailVerified: true,
  name: "Jane Doe",
  image: null,
}

function serializedConnection(): PostgresAdvisoryLockConnection {
  let tail = Promise.resolve()

  return {
    async transaction<T>(handler: (transaction: any) => Promise<T>) {
      let release!: () => void
      const previous = tail
      tail = new Promise<void>((resolve) => {
        release = resolve
      })
      await previous

      try {
        return await handler({ raw: jest.fn().mockResolvedValue(undefined) })
      } finally {
        release()
      }
    },
  }
}

function linkedIdentityService(initialActorId?: string) {
  let appMetadata: Record<string, unknown> = initialActorId
    ? { customer_id: initialActorId }
    : {}
  const providerIdentity = {
    id: "provider-1",
    auth_identity_id: "identity-1",
  }

  return {
    listProviderIdentities: jest.fn().mockResolvedValue([providerIdentity]),
    retrieveAuthIdentity: jest.fn(async () => ({
      id: "identity-1",
      app_metadata: { ...appMetadata },
    })),
    updateAuthIdentities: jest.fn(async ({ app_metadata }) => {
      await Promise.resolve()
      appMetadata = app_metadata
      return { id: "identity-1", app_metadata: appMetadata }
    }),
    createAuthIdentities: jest.fn(),
  }
}

describe("ensureLinkedIdentity", () => {
  it("allows idempotent concurrent links to the same actor", async () => {
    const connection = serializedConnection()
    const service = linkedIdentityService()

    const results = await Promise.all([
      ensureLinkedIdentity(
        service as any,
        baUser,
        "customer_id",
        "customer-1",
        connection
      ),
      ensureLinkedIdentity(
        service as any,
        baUser,
        "customer_id",
        "customer-1",
        connection
      ),
    ])

    expect(results).toEqual([true, true])
    expect(service.updateAuthIdentities).toHaveBeenCalledTimes(1)
  })

  it("prevents concurrent links to different actors from overwriting metadata", async () => {
    const connection = serializedConnection()
    const service = linkedIdentityService()

    const results = await Promise.all([
      ensureLinkedIdentity(
        service as any,
        baUser,
        "customer_id",
        "customer-1",
        connection
      ),
      ensureLinkedIdentity(
        service as any,
        baUser,
        "customer_id",
        "customer-2",
        connection
      ),
    ])

    expect(results).toEqual([true, false])
    expect(service.updateAuthIdentities).toHaveBeenCalledTimes(1)
  })
})

describe("caseInsensitiveEmailFilter", () => {
  it("wraps the email in an $ilike operator", () => {
    expect(caseInsensitiveEmailFilter("jane@test.dev")).toEqual({
      $ilike: "jane@test.dev",
    })
  })

  it("escapes ILIKE wildcards so the email stays a literal", () => {
    expect(caseInsensitiveEmailFilter("j_ne%\\x@test.dev")).toEqual({
      $ilike: "j\\_ne\\%\\\\x@test.dev",
    })
  })
})

describe("pickActorByEmail", () => {
  const jane = { id: "1", email: "jane@test.dev" }
  const janeUpper = { id: "2", email: "Jane@test.dev" }

  it("prefers the exact-case match when several actors differ only by case", () => {
    expect(pickActorByEmail([janeUpper, jane], "jane@test.dev")).toBe(jane)
  })

  it("falls back to the first case-insensitive match", () => {
    expect(pickActorByEmail([janeUpper], "jane@test.dev")).toBe(janeUpper)
  })

  it("returns undefined when there is no match", () => {
    expect(pickActorByEmail([], "jane@test.dev")).toBeUndefined()
  })
})
