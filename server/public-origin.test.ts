import { describe, expect, it } from "vitest";
import { getPublicConfigurationDiagnostics, getCanonicalPublicOrigin, resolvePublicOrigins } from "./public-origin";

describe("origem pública e diagnóstico de configuração", () => {
  it("resolve produção, preview e local sem aceitar caminhos ou credenciais", () => {
    expect(resolvePublicOrigins({ NODE_ENV: "production", PUBLIC_SITE_URL: "https://weekendvib-oficial.manus.space/", VERCEL_URL: "preview-weekendvibes.vercel.app" } as NodeJS.ProcessEnv)).toEqual({
      canonicalOrigin: "https://weekendvib-oficial.manus.space",
      deploymentOrigin: "https://preview-weekendvibes.vercel.app",
    });
    expect(resolvePublicOrigins({ NODE_ENV: "development", PUBLIC_SITE_URL: "http://localhost:3000" } as NodeJS.ProcessEnv)).toEqual({
      canonicalOrigin: "http://localhost:3000",
      deploymentOrigin: "http://localhost:3000",
    });
    expect(resolvePublicOrigins({ NODE_ENV: "production", PUBLIC_SITE_URL: "https://old.example/path", VERCEL_URL: "" } as NodeJS.ProcessEnv)).toEqual({
      canonicalOrigin: "https://weekendvib-oficial.manus.space",
    });
  });

  it("usa fallback estável em produção e não expõe valores sensíveis", () => {
    const env = {
      NODE_ENV: "production",
      OPENAI_API_KEY: "sk-secret-value",
      APIFY_API_TOKEN: "apify-secret-value",
    } as NodeJS.ProcessEnv;
    expect(getCanonicalPublicOrigin(env)).toBe("https://weekendvib-oficial.manus.space");
    expect(getPublicConfigurationDiagnostics(env)).toEqual(expect.objectContaining({
      publicOrigin: "https://weekendvib-oficial.manus.space",
      openAiConfigured: true,
      apifyConfigured: true,
    }));
    expect(JSON.stringify(getPublicConfigurationDiagnostics(env))).not.toContain("secret-value");
  });
});
