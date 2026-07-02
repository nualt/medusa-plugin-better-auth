import {
  caseInsensitiveEmailFilter,
  normalizeCustomerEmail,
} from "../customer-email"

describe("customer email helpers", () => {
  it("trims and lowercases new customer emails", () => {
    expect(normalizeCustomerEmail("  Jane@Example.COM ")).toBe(
      "jane@example.com"
    )
  })

  it("escapes ILIKE wildcards", () => {
    expect(caseInsensitiveEmailFilter("j_ne%\\x@test.dev")).toEqual({
      $ilike: "j\\_ne\\%\\\\x@test.dev",
    })
  })
})
