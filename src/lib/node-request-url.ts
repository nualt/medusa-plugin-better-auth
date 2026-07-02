type MountedNodeRequest = {
  baseUrl: string
  originalUrl: string
  url: string
}

/**
 * Present the complete Express URL to a Node handler while a wildcard mount
 * has consumed the request path into `baseUrl`.
 *
 * Better Call reconstructs mounted URLs from `baseUrl` and `url`. Express
 * wildcard mounts expose a trailing-slash `url` (for example
 * `/?state=...`), which can make that reconstruction drop the query string.
 * Temporarily treating the request as application-mounted keeps the original
 * path and query intact. The Express values are restored for error handling
 * and any later middleware.
 */
export async function withFullRequestUrl<T>(
  req: MountedNodeRequest,
  handler: () => T | Promise<T>
): Promise<T> {
  const previousUrl = req.url
  const previousBaseUrl = req.baseUrl

  req.url = req.originalUrl
  req.baseUrl = ""

  try {
    return await handler()
  } finally {
    req.url = previousUrl
    req.baseUrl = previousBaseUrl
  }
}
