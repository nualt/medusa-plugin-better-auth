import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getPluginOptions } from "../../../../lib/better-auth"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const options = getPluginOptions()
  res.json({
    social: Object.keys(options.betterAuth.socialProviders ?? {}),
    email_password: Boolean(options.betterAuth.emailAndPassword?.enabled),
  })
}
