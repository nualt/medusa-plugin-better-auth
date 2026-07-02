const configLoader = jest.fn()
const runBetterAuthMigrations = jest.fn()

jest.mock("@medusajs/framework/config", () => ({
  configLoader: (...args: unknown[]) => configLoader(...args),
}))
jest.mock("../../lib/better-auth", () => ({
  runBetterAuthMigrations: () => runBetterAuthMigrations(),
}))

import { main } from "../migrate"

describe("migrate CLI", () => {
  let stderr: jest.SpyInstance
  let stdout: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    stderr = jest.spyOn(process.stderr, "write").mockReturnValue(true)
    stdout = jest.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    stderr.mockRestore()
    stdout.mockRestore()
  })

  it("prints usage and fails without the migrate command", async () => {
    expect(await main([])).toBe(1)
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("Usage:"))
    expect(runBetterAuthMigrations).not.toHaveBeenCalled()
  })

  it("rejects unknown commands", async () => {
    expect(await main(["seed"])).toBe(1)
    expect(runBetterAuthMigrations).not.toHaveBeenCalled()
  })

  it("hydrates the config then runs the migrations", async () => {
    const order: string[] = []
    configLoader.mockImplementation(async () => order.push("config"))
    runBetterAuthMigrations.mockImplementation(async () =>
      order.push("migrations")
    )

    expect(await main(["migrate"])).toBe(0)
    expect(configLoader).toHaveBeenCalledWith(process.cwd(), "medusa-config")
    expect(order).toEqual(["config", "migrations"])
  })

  it("propagates migration failures", async () => {
    runBetterAuthMigrations.mockRejectedValue(new Error("boom"))
    await expect(main(["migrate"])).rejects.toThrow("boom")
  })
})
