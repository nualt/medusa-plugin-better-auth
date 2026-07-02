export type PostgresAdvisoryLockConnection = {
  transaction<T>(
    handler: (transaction: {
      raw(sql: string, bindings?: readonly unknown[]): Promise<unknown>
    }) => Promise<T>
  ): Promise<T>
}

/**
 * Serializes work across backend processes using a transaction-scoped
 * PostgreSQL advisory lock. PostgreSQL releases the lock automatically when
 * the transaction completes, including when the operation throws.
 */
export function withPostgresAdvisoryLock<T>(
  connection: PostgresAdvisoryLockConnection,
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  return connection.transaction(async (transaction) => {
    await transaction.raw(
      "select pg_advisory_xact_lock(hashtextextended(?, 0))",
      [key]
    )
    return operation()
  })
}
