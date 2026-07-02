import { resolvePluginOptions, PLUGIN_NAME } from "../options"

const baseConfig = (plugins: unknown[]): any => ({
  projectConfig: {
    databaseUrl: "postgres://postgres:postgres@localhost/medusa-test",
    http: {
      storeCors: "http://localhost:8000",
      adminCors: "http://localhost:9000",
      authCors: "http://localhost:8000,http://localhost:9000",
    },
  },
  plugins,
})

const pluginEntry = (options: Record<string, unknown>) => ({
  resolve: PLUGIN_NAME,
  options,
})

describe("resolvePluginOptions", () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV }
    delete process.env.BETTER_AUTH_SECRET
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it("throws when the plugin entry is missing", () => {
    expect(() => resolvePluginOptions(baseConfig([]))).toThrow(
      /medusa-plugin-better-auth/
    )
  })

  it("throws when no secret is configured", () => {
    const config = baseConfig([pluginEntry({ betterAuth: {} })])
    expect(() => resolvePluginOptions(config)).toThrow(/BETTER_AUTH_SECRET/)
  })

  it("falls back to the BETTER_AUTH_SECRET env variable", () => {
    process.env.BETTER_AUTH_SECRET = "env-secret"
    const config = baseConfig([pluginEntry({ betterAuth: {} })])
    const resolved = resolvePluginOptions(config)
    expect(resolved.betterAuth.secret).toEqual("env-secret")
  })

  it("derives trusted origins from Medusa CORS settings, deduplicated", () => {
    process.env.BETTER_AUTH_SECRET = "s"
    const resolved = resolvePluginOptions(
      baseConfig([pluginEntry({ betterAuth: {} })])
    )
    expect(resolved.trustedOrigins.sort()).toEqual([
      "http://localhost:8000",
      "http://localhost:9000",
    ])
  })

  it("applies customer linking, migration, and email normalization defaults", () => {
    process.env.BETTER_AUTH_SECRET = "s"
    const resolved = resolvePluginOptions(
      baseConfig([pluginEntry({ betterAuth: {} })])
    )
    expect(resolved.autoLink).toEqual("verified-email")
    expect(resolved.autoMigrate).toBe(true)
    expect(resolved.normalizeCustomerEmails).toBe(true)
  })

  it("allows customer email normalization to be disabled explicitly", () => {
    process.env.BETTER_AUTH_SECRET = "s"
    const resolved = resolvePluginOptions(
      baseConfig([
        pluginEntry({
          betterAuth: {},
          normalizeCustomerEmails: false,
        }),
      ])
    )
    expect(resolved.normalizeCustomerEmails).toBe(false)
  })

  it("matches a plugin entry resolved by local path", () => {
    process.env.BETTER_AUTH_SECRET = "s"
    const config = baseConfig([
      { resolve: `/some/path/packages/${PLUGIN_NAME}`, options: { betterAuth: {} } },
    ])
    expect(() => resolvePluginOptions(config)).not.toThrow()
  })
})
