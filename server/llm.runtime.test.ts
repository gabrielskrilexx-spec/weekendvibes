import { afterEach, describe, expect, it, vi } from "vitest";
import { getLLMConfigurationStatus, invokeLLM } from "./_core/llm";

describe("LLM runtime configuration", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("reads OPENAI_API_KEY added after module initialization", async () => {
    process.env.OPENAI_API_KEY = "runtime-test-key";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer runtime-test-key");
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(invokeLLM({ messages: [{ role: "user", content: "ping" }] })).resolves.toMatchObject({ choices: [{ message: { content: "ok" } }] });
    expect(getLLMConfigurationStatus().configured).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns only safe presence metadata", () => {
    process.env.OPENAI_API_KEY = "secret-that-must-not-leak";
    expect(getLLMConfigurationStatus()).toEqual({ configured: true, source: "runtime" });
  });
});
