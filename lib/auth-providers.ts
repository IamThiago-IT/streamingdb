import "server-only";

export type SocialProvider = "google" | "github";

const envByProvider: Record<
  SocialProvider,
  { clientId?: string; clientSecret?: string }
> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
};

/**
 * Retorna a config do provedor somente se clientId e clientSecret estiverem
 * definidos. Provedores sem credenciais ficam desativados (não aparecem no UI
 * e o Better Auth não registra a rota de callback).
 */
export function getSocialProviderConfig(
  provider: SocialProvider
): { clientId: string; clientSecret: string } | null {
  const { clientId, clientSecret } = envByProvider[provider];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Provedores sociais com credenciais configuradas no ambiente. */
export function getEnabledSocialProviders(): SocialProvider[] {
  return (Object.keys(envByProvider) as SocialProvider[]).filter(
    (provider) => getSocialProviderConfig(provider) !== null
  );
}
