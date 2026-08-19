import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

describe("session signing", () => {
  const originalSecret = ENV.cookieSecret;

  afterEach(() => {
    ENV.cookieSecret = originalSecret;
  });

  it("deriva uma chave segura e valida a sessão com um segredo configurado curto", async () => {
    ENV.cookieSecret = "platform-secret-value";

    const token = await sdk.createSessionToken("user-short-secret", {
      name: "WeekendVibes Admin",
      expiresInMs: 60_000,
    });
    const session = await sdk.verifySession(token);

    expect(session).toMatchObject({
      openId: "user-short-secret",
      appId: ENV.appId,
      name: "WeekendVibes Admin",
    });
  });

  it("rejeita segredo ausente em vez de criar uma sessão sem assinatura", async () => {
    ENV.cookieSecret = "";

    await expect(sdk.createSessionToken("user-without-secret")).rejects.toThrow(
      "JWT_SECRET is required",
    );
  });
});
