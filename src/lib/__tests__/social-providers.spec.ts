import {
  SOCIAL_PROVIDERS,
  socialProvidersFromEnv,
  providerLabel,
} from "../social-providers"

describe("SOCIAL_PROVIDERS registry", () => {
  it("contains exactly the curated e-commerce providers", () => {
    expect(SOCIAL_PROVIDERS.map((p) => p.id)).toEqual([
      "google",
      "apple",
      "facebook",
      "microsoft",
      "discord",
      "tiktok",
      "twitter",
      "github",
    ])
  })

  it("labels twitter as X", () => {
    expect(SOCIAL_PROVIDERS.find((p) => p.id === "twitter")?.label).toBe("X")
  })
})

describe("socialProvidersFromEnv", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
  afterEach(() => warn.mockClear())
  afterAll(() => warn.mockRestore())

  it("builds a provider entry for each complete env pair", () => {
    const result = socialProvidersFromEnv({
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
      GITHUB_CLIENT_ID: "ghid",
      GITHUB_CLIENT_SECRET: "ghsecret",
    })
    expect(result).toEqual({
      google: { clientId: "gid", clientSecret: "gsecret" },
      github: { clientId: "ghid", clientSecret: "ghsecret" },
    })
  })

  it("returns an empty object when nothing is configured", () => {
    expect(socialProvidersFromEnv({})).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })

  it("ignores an incomplete pair and warns explicitly", () => {
    const result = socialProvidersFromEnv({ FACEBOOK_CLIENT_ID: "fid" })
    expect(result).toEqual({})
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("FACEBOOK_CLIENT_SECRET")
    )
  })

  it("ignores empty-string values", () => {
    expect(
      socialProvidersFromEnv({
        DISCORD_CLIENT_ID: "",
        DISCORD_CLIENT_SECRET: "s",
      })
    ).toEqual({})
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("DISCORD_CLIENT_ID")
    )
  })

  it("warns with the missing CLIENT_ID when only the secret is set", () => {
    const result = socialProvidersFromEnv({ GITHUB_CLIENT_SECRET: "s" })
    expect(result).toEqual({})
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("GITHUB_CLIENT_ID")
    )
  })

  it("does not scan providers outside the registry", () => {
    expect(
      socialProvidersFromEnv({
        DROPBOX_CLIENT_ID: "x",
        DROPBOX_CLIENT_SECRET: "y",
      })
    ).toEqual({})
  })
})

describe("providerLabel", () => {
  it("returns the registry label", () => {
    expect(providerLabel("twitter")).toBe("X")
  })
  it("capitalizes unknown ids", () => {
    expect(providerLabel("kick")).toBe("Kick")
  })
})
