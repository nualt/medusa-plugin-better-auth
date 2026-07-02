import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { getPluginOptions } from "../../../../../lib/better-auth"
import type { PostgresAdvisoryLockConnection } from "../../../../../lib/postgres-advisory-lock"
import { ensureLinkedIdentity, getSessionUser } from "../helpers"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const baUser = await getSessionUser(req)
  if (!baUser) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "No Better Auth session found."
    )
  }

  const { autoLink } = getPluginOptions()

  // Liaison automatique uniquement sur email vérifié (défaut) ; en
  // "never", l'inscription passe toujours par POST /store/customers.
  if (autoLink === "never" || !baUser.emailVerified) {
    res.status(204).send()
    return
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER)
  const [customer] = await customerService.listCustomers({
    email: baUser.email,
    has_account: true,
  })
  if (!customer) {
    res.status(204).send()
    return
  }

  const linked = await ensureLinkedIdentity(
    req.scope.resolve(Modules.AUTH),
    baUser,
    "customer_id",
    customer.id,
    req.scope.resolve(
      ContainerRegistrationKeys.PG_CONNECTION
    ) as PostgresAdvisoryLockConnection
  )
  if (!linked) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This identity is already linked to a different account."
    )
  }

  res.status(204).send()
}
