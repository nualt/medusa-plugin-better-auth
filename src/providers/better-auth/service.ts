import { AbstractAuthModuleProvider } from "@medusajs/framework/utils"
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
  Logger,
} from "@medusajs/framework/types"
import { getBetterAuth } from "../../lib/better-auth"

type InjectedDependencies = {
  logger: Logger
}

const LINK_HINT =
  "This Better Auth identity is not linked to an admin account. " +
  "Complete the linking step first (POST /better-auth/bridge/link/user)."

/**
 * Convert a plain headers object (IncomingHttpHeaders-style) into a WHATWG
 * Headers instance without importing fromNodeHeaders from better-auth/node
 * (which is ESM-only and breaks the CJS build of the plugin).
 */
function nodeHeadersToFetch(
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

export class BetterAuthProviderService extends AbstractAuthModuleProvider {
  static identifier = "better-auth"
  static DISPLAY_NAME = "Better Auth"

  protected logger_: Logger

  constructor(
    { logger }: InjectedDependencies,
    options: Record<string, unknown>
  ) {
    // @ts-ignore — parent signature expects (container, config)
    super(...arguments)
    this.logger_ = logger
  }

  async authenticate(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const auth = await getBetterAuth()
    const session = await auth.api.getSession({
      headers: nodeHeadersToFetch(
        (data.headers ?? {}) as Record<string, string | string[] | undefined>
      ),
    })

    if (!session?.user) {
      return {
        success: false,
        error:
          "No Better Auth session found. Complete a Better Auth sign-in flow first.",
      }
    }

    const entityId = session.user.id

    let authIdentity
    try {
      authIdentity = await authIdentityProviderService.retrieve({
        entity_id: entityId,
      })
    } catch {
      // Identity unknown to Medusa.
      if (data.actor_type === "user") {
        // Invariant: never auto-create admin side — linking to an existing
        // Medusa user must go through the bridge route with a verified email.
        return { success: false, error: LINK_HINT }
      }
      authIdentity = await authIdentityProviderService.create({
        entity_id: entityId,
        user_metadata: {
          email: session.user.email,
          email_verified: session.user.emailVerified,
          name: session.user.name ?? null,
          image: session.user.image ?? null,
        },
      })
    }

    if (
      data.actor_type === "user" &&
      !(authIdentity.app_metadata as Record<string, unknown> | undefined)
        ?.user_id
    ) {
      return { success: false, error: LINK_HINT }
    }

    return { success: true, authIdentity }
  }

  async validateCallback(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    // OAuth callbacks are handled by Better Auth itself under
    // /better-auth/callback/*; on the Medusa side, validate = authenticate.
    return this.authenticate(data, authIdentityProviderService)
  }

  async register(
    _data: AuthenticationInput,
    _authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    return {
      success: false,
      error:
        "Registration is handled by Better Auth. Use the flows under /better-auth (sign-up, social sign-in, magic link…).",
    }
  }

  async update(
    _data: Record<string, unknown>,
    _authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    return {
      success: false,
      error: "Account updates are handled by Better Auth, not this provider.",
    }
  }
}
