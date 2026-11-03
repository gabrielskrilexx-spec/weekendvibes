import { describe, expect, it } from "vitest";
import { classifyIngestionSourceFailure, resolveIngestionSourceFailureReason } from "./db";

describe("classificação de falhas de ingestionSources", () => {
  it("persiste 403 de fonte pública como BLOCKED_BY_PLATFORM quando há política de cooldown", () => {
    expect(resolveIngestionSourceFailureReason({
      sourceKey: "public:sympla",
      status: 403,
      message: "Fonte externa respondeu HTTP 403",
      platformBlockCooldownMs: 7 * 24 * 60 * 60 * 1000,
    })).toBe("BLOCKED_BY_PLATFORM");
  });

  it("não classifica 403 de outras integrações como bloqueio de plataforma pública", () => {
    expect(resolveIngestionSourceFailureReason({
      sourceKey: "instagram:profile",
      status: 403,
      message: "Forbidden",
      platformBlockCooldownMs: 7 * 24 * 60 * 60 * 1000,
    })).toBe("403 - Proibido");
  });

  it("contabiliza BLOCKED_BY_PLATFORM na categoria WAF", () => {
    expect(classifyIngestionSourceFailure({
      lastMessage: "HTTP 403: Fonte bloqueada",
      lastFailureReason: "BLOCKED_BY_PLATFORM",
      lastHttpStatus: 403,
    })).toBe("waf");
  });
});
