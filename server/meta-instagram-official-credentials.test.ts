import { describe, expect, it } from "vitest";

const graphBase = "https://graph.facebook.com/v26.0";

describe("Official Meta Instagram credentials", () => {
  it("validates the User Access Token and account identity through Facebook Graph", async () => {
    const token = process.env.META_INSTAGRAM_TOKEN;
    const accountId = process.env.META_INSTAGRAM_ACCOUNT_ID;
    expect(token, "META_INSTAGRAM_TOKEN must be configured").toBeTruthy();
    expect(accountId, "META_INSTAGRAM_ACCOUNT_ID must be configured").toBeTruthy();

    const meResponse = await fetch(
      `${graphBase}/me?fields=id,name&access_token=${encodeURIComponent(token!)}`,
    );
    const me = (await meResponse.json()) as {
      id?: string;
      name?: string;
      error?: { message?: string };
    };
    expect(meResponse.ok, me.error?.message ?? `Meta Graph API /me returned HTTP ${meResponse.status}`).toBe(true);
    expect(me.id).toBeTruthy();

    const accountResponse = await fetch(
      `${graphBase}/${accountId}?fields=id&access_token=${encodeURIComponent(token!)}`,
    );
    const account = (await accountResponse.json()) as { id?: string; error?: { message?: string } };
    expect(accountResponse.ok, account.error?.message ?? `Meta Graph API account lookup returned HTTP ${accountResponse.status}`).toBe(true);
    expect(account.id).toBe(accountId);
  }, 20_000);
});
