import { lazyBetterAuthPlugin, resolveLazyPlugins } from "../lazy-plugins"

describe("lazyBetterAuthPlugin", () => {
  it("builds a descriptor with defaults", () => {
    const d = lazyBetterAuthPlugin("magicLink", { a: 1 })
    expect(d).toEqual({
      __lazyBetterAuthPlugin: true,
      module: "better-auth/plugins",
      export: "magicLink",
      options: { a: 1 },
    })
  })
})

describe("resolveLazyPlugins", () => {
  it("returns undefined-safe empty array", async () => {
    expect(await resolveLazyPlugins(undefined)).toEqual([])
  })

  it("passes through non-descriptor plugin objects untouched", async () => {
    const real = { id: "already-built" }
    expect(await resolveLazyPlugins([real])).toEqual([real])
  })

  it("resolves a descriptor via dynamic import and calls the factory with options", async () => {
    // "better-auth/plugins" est ESM-only ; on résout un vrai export pour
    // prouver l'interop : magicLink est une factory qui retourne un objet
    // plugin avec un id.
    const sendMagicLink = jest.fn()
    const [plugin] = (await resolveLazyPlugins([
      lazyBetterAuthPlugin("magicLink", { sendMagicLink }),
    ])) as [{ id: string }]
    expect(plugin.id).toBe("magic-link")
  })

  it("throws an actionable error for an unknown export", async () => {
    await expect(
      resolveLazyPlugins([lazyBetterAuthPlugin("nopeNope")])
    ).rejects.toThrow(/nopeNope/)
  })
})
