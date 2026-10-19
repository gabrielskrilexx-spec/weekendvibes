import { afterEach, describe, expect, it, vi } from "vitest";
import { sdk } from "./_core/sdk";

describe("session signing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deriva uma chave segura e valida a sessão com um segredo configurado curto", async () => {
    vi.stubEnv("JWT_SECRET", "platform-secret-value");
    vi.stubEnv("VITE_APP_ID", "test-app-id");

    const token = await sdk.createSessionToken("user-short-secret", {
      name: "WeekendVibes Admin",
      expiresInMs: 60_000,
    });
    const session = await sdk.verifySession(token);

    expect(session).toMatchObject({
      openId: "user-short-secret",
      appId: "test-app-id",
      name: "WeekendVibes Admin",
    });
  });

  it("rejeita segredo ausente em vez de criar uma sessão sem assinatura", async () => {
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("VITE_APP_ID", "test-app-id");

    await expect(sdk.createSessionToken("user-without-secret")).rejects.toThrow(
      "JWT_SECRET is required in environment variables",
    );
  });
});
