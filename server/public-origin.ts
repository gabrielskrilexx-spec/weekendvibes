const CANONICAL_FALLBACK_ORIGIN = "https://weekendvib-oficial.manus.space";

export type PublicOrigins = {
  canonicalOrigin?: string;
  deploymentOrigin?: string;
};

function normalizeOrigin(value: unknown, allowHttpLocalhost = true): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const raw = value.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    if (url.protocol !== "https:" && !(allowHttpLocalhost && isLocal && url.protocol === "http:")) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function resolvePublicOrigins(env: NodeJS.ProcessEnv = process.env): PublicOrigins {
  const isProduction = env.NODE_ENV === "production" || env.VERCEL === "1";
  const configured = normalizeOrigin(env.PUBLIC_SITE_URL, !isProduction);
  const deployment = normalizeOrigin(env.VERCEL_URL, false) ?? configured;
  const production = normalizeOrigin(env.VERCEL_PROJECT_PRODUCTION_URL, false);
  const canonical = configured ?? production ?? (isProduction ? CANONICAL_FALLBACK_ORIGIN : undefined);
  return {
    ...(canonical ? { canonicalOrigin: canonical } : {}),
    ...(deployment ? { deploymentOrigin: deployment } : {}),
  };
}

export function getCanonicalPublicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return resolvePublicOrigins(env).canonicalOrigin ?? CANONICAL_FALLBACK_ORIGIN;
}

export function getDeploymentPublicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const origins = resolvePublicOrigins(env);
  return origins.deploymentOrigin ?? origins.canonicalOrigin ?? CANONICAL_FALLBACK_ORIGIN;
}

export function getPublicConfigurationDiagnostics(env: NodeJS.ProcessEnv = process.env) {
  const origins = resolvePublicOrigins(env);
  return {
    publicOrigin: origins.canonicalOrigin ?? null,
    deploymentOrigin: origins.deploymentOrigin ?? null,
    publicOriginConfigured: Boolean(env.PUBLIC_SITE_URL?.trim()),
    oauthRedirectConfigured: Boolean(env.OAUTH_REDIRECT_URI?.trim()),
    oauthClientConfigured: Boolean(env.OAUTH_CLIENT_ID?.trim() && env.OAUTH_CLIENT_SECRET?.trim()),
    openAiConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    apifyConfigured: Boolean(env.APIFY_API_TOKEN?.trim()),
  };
}

export function isAllowedConfiguredOrigin(value: unknown, env: NodeJS.ProcessEnv = process.env): value is string {
  if (typeof value !== "string") return false;
  const normalized = normalizeOrigin(value, env.NODE_ENV !== "production" && env.VERCEL !== "1");
  if (!normalized) return false;
  const origins = resolvePublicOrigins(env);
  return normalized === origins.canonicalOrigin || normalized === origins.deploymentOrigin || normalized.startsWith("http://localhost:") || normalized.startsWith("http://127.0.0.1:");
}

export const DEFAULT_PUBLIC_ORIGIN = CANONICAL_FALLBACK_ORIGIN;
