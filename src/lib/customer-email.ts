/**
 * Canonical form used for newly-created customer and guest emails.
 * Existing auth identities are resolved case-insensitively before login so
 * enabling normalization does not lock out legacy mixed-case accounts.
 */
export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Escapes ILIKE wildcards so the email remains a literal value. */
export function caseInsensitiveEmailFilter(email: string): { $ilike: string } {
  return { $ilike: email.replace(/[\\%_]/g, "\\$&") }
}
