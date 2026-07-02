import type { MedusaRequest } from "@medusajs/framework/http"
import type { IAuthModuleService } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { getBetterAuth } from "../../../../lib/better-auth"
import { nodeHeadersToFetch } from "../../../../lib/node-headers"

export const PROVIDER = "better-auth"

export type BridgeSessionUser = {
  id: string
  email: string
  emailVerified: boolean
  name?: string | null
  image?: string | null
}

export async function getSessionUser(
  req: MedusaRequest
): Promise<BridgeSessionUser | null> {
  const auth = await getBetterAuth()
  const session = await auth.api.getSession({
    headers: nodeHeadersToFetch(
      req.headers as Record<string, string | string[] | undefined>
    ),
  })
  return (session?.user as BridgeSessionUser) ?? null
}

/**
 * Lie (ou crée liée) l'auth_identity better-auth au couple
 * { actor_key: actor_id } — ex. { user_id: "user_123" }.
 * Idempotent : ne touche à rien si la liaison existe déjà.
 * Renvoie false si l'identité est déjà liée à un AUTRE acteur.
 */
export async function ensureLinkedIdentity(
  authService: IAuthModuleService,
  baUser: BridgeSessionUser,
  actorKey: "customer_id" | "user_id",
  actorId: string
): Promise<boolean> {
  // Check-then-create window is acceptable: linking is a human-rate operation and re-runs are idempotent.
  const [providerIdentity] = await authService.listProviderIdentities({
    provider: PROVIDER,
    entity_id: baUser.id,
  })

  const userMetadata = {
    email: baUser.email,
    email_verified: baUser.emailVerified,
    name: baUser.name ?? null,
    image: baUser.image ?? null,
  }

  if (!providerIdentity) {
    await authService.createAuthIdentities({
      provider_identities: [
        {
          provider: PROVIDER,
          entity_id: baUser.id,
          user_metadata: userMetadata,
        },
      ],
      app_metadata: { [actorKey]: actorId },
    })
    return true
  }

  if (!providerIdentity.auth_identity_id) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Provider identity has no auth identity"
    )
  }
  const identity = await authService.retrieveAuthIdentity(
    providerIdentity.auth_identity_id
  )
  const appMetadata = (identity.app_metadata ?? {}) as Record<string, unknown>

  if (appMetadata[actorKey] === actorId) {
    return true
  }
  if (appMetadata[actorKey]) {
    return false
  }

  await authService.updateAuthIdentities({
    id: identity.id,
    app_metadata: { ...appMetadata, [actorKey]: actorId },
  })
  return true
}
