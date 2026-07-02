/**
 * Convert a plain Node.js headers object (IncomingHttpHeaders-style) into a
 * WHATWG Headers instance.
 *
 * We cannot use `fromNodeHeaders` from `better-auth/node` because that module
 * is ESM-only and breaks the CJS build produced by `medusa plugin:build`.
 */
export function nodeHeadersToFetch(
  raw: Record<string, string | string[] | undefined>
): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "))
    } else {
      headers.set(key, value)
    }
  }
  return headers
}
