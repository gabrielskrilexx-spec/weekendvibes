import { describe, expect, it } from "vitest";
import { normalizeEventIdentityForDuplicateReport } from "./db";

describe("diagnóstico de duplicidades exatas", () => {
  it("agrupa título, data, local e cidade independentemente de acentos e caixa", () => {
    const first = normalizeEventIdentityForDuplicateReport({ title: "Baile da Liderança", eventDate: "2026-12-19T22:00:00-03:00", locationName: "Vallum Garden", city: "Santos" });
    const second = normalizeEventIdentityForDuplicateReport({ title: "BAILE DA LIDERANCA", eventDate: "2026-12-20T01:00:00Z", locationName: "vallum garden", city: "santos" });
    expect(first).toBe(second);
  });

  it("mantém cidades ou locais diferentes fora do mesmo grupo", () => {
    const santos = normalizeEventIdentityForDuplicateReport({ title: "O Encontro", eventDate: "2026-12-12T22:00:00-03:00", locationName: "Arena Club", city: "Santos" });
    const guaruja = normalizeEventIdentityForDuplicateReport({ title: "O Encontro", eventDate: "2026-12-12T22:00:00-03:00", locationName: "Arena Club", city: "Guarujá" });
    expect(santos).not.toBe(guaruja);
  });
});
