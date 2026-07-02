import { PROVIDER_ICONS, getProviderDisplay } from "../provider-icons"
import { SOCIAL_PROVIDERS } from "../../lib/social-providers"

describe("PROVIDER_ICONS", () => {
  it("covers every provider of the curated registry", () => {
    for (const { id } of SOCIAL_PROVIDERS) {
      expect(PROVIDER_ICONS[id]).toBeDefined()
      expect(PROVIDER_ICONS[id].viewBox).toMatch(/^0 0 \d+ \d+$/)
      expect(PROVIDER_ICONS[id].paths.length).toBeGreaterThan(0)
      for (const path of PROVIDER_ICONS[id].paths) {
        expect(path.d.length).toBeGreaterThan(10)
      }
    }
  })

  it("contains no JSX artifacts (pure data)", () => {
    expect(typeof PROVIDER_ICONS.google.paths[0].d).toBe("string")
  })
})

describe("getProviderDisplay", () => {
  it("returns label and icon for a registry provider", () => {
    const display = getProviderDisplay("twitter")
    expect(display.label).toBe("X")
    expect(display.icon).not.toBeNull()
  })

  it("falls back to capitalized label and null icon for unknown providers", () => {
    const display = getProviderDisplay("kick")
    expect(display.label).toBe("Kick")
    expect(display.icon).toBeNull()
  })
})
