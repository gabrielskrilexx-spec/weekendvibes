import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { startAsyncApifyStoriesRun } from "./apify-async";

const SECRET = "instagram-session-cookie-test-value";

describe("Apify Stories session cookie", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    token: process.env.APIFY_API_TOKEN,
    baseUrl: process.env.SCHEDULED_TASK_ENDPOINT_BASE,
    cookie: process.env.APIFY_INSTAGRAM_SESSION_COOKIE,
  };

  beforeEach(() => {
    process.env.APIFY_API_TOKEN = "apify-test-token";
    process.env.SCHEDULED_TASK_ENDPOINT_BASE = "https://weekendvib-jscaalye.manus.space";
    process.env.APIFY_INSTAGRAM_SESSION_COOKIE = SECRET;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "actor-run-cookie", defaultDatasetId: "dataset-cookie" } }), { status: 201, headers: { "content-type": "application/json" } })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
    if (originalEnv.token === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = originalEnv.token;
    if (originalEnv.baseUrl === undefined) delete process.env.SCHEDULED_TASK_ENDPOINT_BASE; else process.env.SCHEDULED_TASK_ENDPOINT_BASE = originalEnv.baseUrl;
    if (originalEnv.cookie === undefined) delete process.env.APIFY_INSTAGRAM_SESSION_COOKIE; else process.env.APIFY_INSTAGRAM_SESSION_COOKIE = originalEnv.cookie;
  });

  it("sends the session cookie only in the Actor JSON input, never in the URL", async () => {
    await startAsyncApifyStoriesRun({ trigger: "manual" });
    const request = vi.mocked(globalThis.fetch).mock.calls[0];
    const url = String(request?.[0] ?? "");
    const init = request?.[1] as RequestInit;
    expect(url).toContain("apify~instagram-scraper");
    expect(url).not.toContain(SECRET);
    expect(JSON.parse(String(init.body))).toMatchObject({ usernames: expect.arrayContaining(["meulugar.bar"]), sessionCookie: SECRET, includeHighlights: true, includeProfile: false });
  });
});
