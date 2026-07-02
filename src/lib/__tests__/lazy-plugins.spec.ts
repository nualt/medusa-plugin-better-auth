import { lazyBetterAuthPlugin, resolveLazyPlugins } from "../lazy-plugins"
import { pathToFileURL } from "node:url"

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

  it("rejects relative module paths that change meaning after compilation", () => {
    expect(() =>
      lazyBetterAuthPlugin("customPlugin", {}, "./custom-plugin")
    ).toThrow(/relative.*ambiguous/i)
  })

  it("normalizes absolute module paths to portable file URLs", () => {
    const absolutePath = "/tmp/custom-plugin.mjs"
    expect(
      lazyBetterAuthPlugin("customPlugin", {}, absolutePath).module
    ).toBe(pathToFileURL(absolutePath).href)
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

  it("also rejects handcrafted descriptors with relative module paths", async () => {
    await expect(
      resolveLazyPlugins([
        {
          __lazyBetterAuthPlugin: true,
          module: "../custom-plugin",
          export: "customPlugin",
        },
      ])
    ).rejects.toThrow(/relative.*ambiguous/i)
  })
})
