import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { BetterAuthProviderService } from "./service"

export default ModuleProvider(Modules.AUTH, {
  services: [BetterAuthProviderService],
})

export { BetterAuthProviderService }
