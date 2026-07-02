import { isMagicLinkEnabled } from "../plugin-capabilities"
import { lazyBetterAuthPlugin } from "../lazy-plugins"

describe("isMagicLinkEnabled", () => {
  it("returns true for lazy magicLink descriptor", () => {
    expect(
      isMagicLinkEnabled({
        plugins: [lazyBetterAuthPlugin("magicLink", { sendMagicLink: async () => {} })],
      } as any)
    ).toBe(true)
  })

  it("returns true for resolved magic-link plugin", () => {
    expect(
      isMagicLinkEnabled({
        plugins: [{ id: "magic-link", name: "Magic Link" }],
      } as any)
    ).toBe(true)
  })

  it("returns false when magic link is not configured", () => {
    expect(
      isMagicLinkEnabled({
        plugins: [lazyBetterAuthPlugin("twoFactor", {})],
        socialProviders: { google: {} },
      } as any)
    ).toBe(false)
  })
})
