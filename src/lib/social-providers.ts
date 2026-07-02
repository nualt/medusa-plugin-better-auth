export type SocialProviderMeta = {
  /** Clé Better Auth dans socialProviders */
  id: string
  /** Nom affiché sur les boutons */
  label: string
  /** Préfixe des variables d'environnement */
  envPrefix: string
}

/**
 * Registre curé pour l'e-commerce B2C. Volontairement pas le catalogue
 * Better Auth complet : un provider hors registre reste utilisable en
 * passthrough manuel (et l'UI a un fallback), il n'est simplement pas
 * scanné depuis l'environnement.
 */
export const SOCIAL_PROVIDERS: readonly SocialProviderMeta[] = [
  { id: "google", label: "Google", envPrefix: "GOOGLE" },
  { id: "apple", label: "Apple", envPrefix: "APPLE" },
  { id: "facebook", label: "Facebook", envPrefix: "FACEBOOK" },
  { id: "microsoft", label: "Microsoft", envPrefix: "MICROSOFT" },
  { id: "discord", label: "Discord", envPrefix: "DISCORD" },
  { id: "tiktok", label: "TikTok", envPrefix: "TIKTOK" },
  { id: "twitter", label: "X", envPrefix: "TWITTER" },
  { id: "github", label: "GitHub", envPrefix: "GITHUB" },
]

export function providerLabel(id: string): string {
  const meta = SOCIAL_PROVIDERS.find((p) => p.id === id)
  if (meta) return meta.label
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/**
 * Construit le bloc `socialProviders` Better Auth depuis l'environnement,
 * selon la convention <PREFIX>_CLIENT_ID / <PREFIX>_CLIENT_SECRET.
 * Une paire incomplète est ignorée avec un warning explicite au boot.
 */
export function socialProvidersFromEnv(
  env: Record<string, string | undefined> = process.env
): Record<string, { clientId: string; clientSecret: string }> {
  const result: Record<string, { clientId: string; clientSecret: string }> = {}
  for (const { id, envPrefix } of SOCIAL_PROVIDERS) {
    const clientId = env[`${envPrefix}_CLIENT_ID`]
    const clientSecret = env[`${envPrefix}_CLIENT_SECRET`]
    if (clientId && clientSecret) {
      result[id] = { clientId, clientSecret }
    } else if (clientId || clientSecret) {
      const missing = clientId
        ? `${envPrefix}_CLIENT_SECRET`
        : `${envPrefix}_CLIENT_ID`
      console.warn(
        `[medusa-plugin-better-auth] provider "${id}" ignoré : ${missing} manquant (paire d'env vars incomplète)`
      )
    }
  }
  return result
}
