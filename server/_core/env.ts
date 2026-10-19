export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  oauthClientId: process.env.OAUTH_CLIENT_ID ?? "",
  oauthRedirectUri: process.env.OAUTH_REDIRECT_URI ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  // Never use a VITE_* frontend credential for server-side integrations.
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
