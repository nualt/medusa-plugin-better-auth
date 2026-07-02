// NOTE: `autoLink` deliberately does NOT apply here.
// Admin linking is always explicit: the caller must be an already-invited
// admin user whose email was verified by the provider. There is no
// "auto-link on verified-email" path for admins — this is the sole entry
// point and it always requires both invariants to hold.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { ensureLinkedIdentity, getSessionUser } from "../helpers"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const baUser = await getSessionUser(req)
  if (!baUser) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "No Better Auth session found."
    )
  }
  // Anti account-takeover : on ne lie jamais sur un email non vérifié.
  if (!baUser.emailVerified) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Email not verified by the authentication provider."
    )
  }

  const userService = req.scope.resolve(Modules.USER)
  const [adminUser] = await userService.listUsers({ email: baUser.email })
  if (!adminUser) {
    // Invariant : pas de création d'admin par OAuth.
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "No admin account exists for this email. Ask an administrator for an invitation."
    )
  }

  const linked = await ensureLinkedIdentity(
    req.scope.resolve(Modules.AUTH),
    baUser,
    "user_id",
    adminUser.id
  )
  if (!linked) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This identity is already linked to a different account."
    )
  }

  res.status(204).send()
}
