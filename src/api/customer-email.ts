import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { getPluginOptions } from "../lib/better-auth"
import {
  caseInsensitiveEmailFilter,
  normalizeCustomerEmail,
} from "../lib/customer-email"

type RequestBodies = {
  body?: Record<string, unknown>
  validatedBody?: Record<string, unknown>
}

function requestEmail(req: MedusaRequest): string | null {
  const request = req as unknown as RequestBodies
  const value = request.body?.email ?? request.validatedBody?.email
  return typeof value === "string" ? value : null
}

function setRequestEmail(req: MedusaRequest, email: string): void {
  const request = req as unknown as RequestBodies
  if (request.body && typeof request.body === "object") {
    request.body.email = email
  }
  if (request.validatedBody && typeof request.validatedBody === "object") {
    request.validatedBody.email = email
  }
}

async function assertNoActiveCustomer(
  req: MedusaRequest,
  email: string
): Promise<void> {
  const customerService = req.scope.resolve(Modules.CUSTOMER)
  const customers = await customerService.listCustomers({
    email: caseInsensitiveEmailFilter(email) as unknown as string,
    has_account: true,
  })

  if (customers.length) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      "A customer account already exists for this email. Sign in or reset the password instead."
    )
  }
}

async function canonicalEmailPassEmail(
  req: MedusaRequest,
  email: string
): Promise<string> {
  const normalized = normalizeCustomerEmail(email)
  const authService = req.scope.resolve(Modules.AUTH)
  const identities = await authService.listProviderIdentities({
    provider: "emailpass",
    entity_id: caseInsensitiveEmailFilter(normalized) as unknown as string,
  })

  if (identities.length > 1) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      "Multiple email/password identities match this email. Resolve duplicate email casing before continuing."
    )
  }

  // Preserve the stored casing for legacy identities so existing password
  // hashes remain reachable. New identities always use the normalized value.
  return identities[0]?.entity_id ?? normalized
}

async function normalizeEmailPassRequest(
  req: MedusaRequest,
  rejectExistingCustomer: boolean
): Promise<void> {
  const email = requestEmail(req)
  if (!email) return

  const canonical = await canonicalEmailPassEmail(req, email)
  setRequestEmail(req, canonical)

  if (rejectExistingCustomer) {
    await assertNoActiveCustomer(req, canonical)
  }
}

export async function normalizeCustomerEmailPassLogin(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    if (getPluginOptions().normalizeCustomerEmails) {
      await normalizeEmailPassRequest(req, false)
    }
    return next()
  } catch (error) {
    return next(error)
  }
}

export async function normalizeCustomerEmailPassRegistration(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    if (getPluginOptions().normalizeCustomerEmails) {
      await normalizeEmailPassRequest(req, true)
    }
    return next()
  } catch (error) {
    return next(error)
  }
}

export async function normalizeCustomerCreationEmail(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    if (getPluginOptions().normalizeCustomerEmails) {
      const email = requestEmail(req)
      if (email) {
        const normalized = normalizeCustomerEmail(email)
        setRequestEmail(req, normalized)
        await assertNoActiveCustomer(req, normalized)
      }
    }
    return next()
  } catch (error) {
    return next(error)
  }
}

export function normalizeCartEmail(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (getPluginOptions().normalizeCustomerEmails) {
    const email = requestEmail(req)
    if (email) setRequestEmail(req, normalizeCustomerEmail(email))
  }
  return next()
}
