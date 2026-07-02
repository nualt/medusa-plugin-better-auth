import { ensureLinkedIdentity, type BridgeSessionUser } from "../helpers"
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
