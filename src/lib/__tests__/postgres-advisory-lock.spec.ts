import {
  PostgresAdvisoryLockConnection,
  withPostgresAdvisoryLock,
} from "../postgres-advisory-lock"

describe("withPostgresAdvisoryLock", () => {
  it("holds a transaction-scoped lock while the operation runs", async () => {
    const raw = jest.fn().mockResolvedValue(undefined)
    const operation = jest.fn().mockResolvedValue("linked")
    const connection: PostgresAdvisoryLockConnection = {
      async transaction<T>(handler: (transaction: any) => Promise<T>) {
        return handler({ raw })
      },
    }

    await expect(
      withPostgresAdvisoryLock(connection, "identity-1", operation)
    ).resolves.toBe("linked")
    expect(raw).toHaveBeenCalledWith(
      "select pg_advisory_xact_lock(hashtextextended(?, 0))",
      ["identity-1"]
    )
    expect(raw.mock.invocationCallOrder[0]).toBeLessThan(
      operation.mock.invocationCallOrder[0]
    )
  })

  it("lets transaction cleanup release the lock when the operation fails", async () => {
    const failure = new Error("link failed")
    const connection: PostgresAdvisoryLockConnection = {
      async transaction<T>(handler: (transaction: any) => Promise<T>) {
        return handler({ raw: jest.fn().mockResolvedValue(undefined) })
      },
    }

    await expect(
      withPostgresAdvisoryLock(connection, "identity-1", async () => {
        throw failure
      })
    ).rejects.toBe(failure)
  })
})
