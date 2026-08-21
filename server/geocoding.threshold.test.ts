import { afterEach, describe, expect, it, vi } from "vitest";
import { getPastEventRejectionThreshold } from "./ingestion-reports";
import { resolveRegionalCoordinates } from "./geocoding";

describe("threshold de rejeição por data passada", () => {
  afterEach(() => {
    delete process.env.INGESTION_PAST_DATE_REJECTION_THRESHOLD;
  });

  it("usa 50% como padrão e aceita proporções válidas", () => {
    expect(getPastEventRejectionThreshold()).toBe(0.5);
    process.env.INGESTION_PAST_DATE_REJECTION_THRESHOLD = "0.72";
    expect(getPastEventRejectionThreshold()).toBe(0.72);
  });

  it("reverte para o padrão quando a configuração é inválida", () => {
    process.env.INGESTION_PAST_DATE_REJECTION_THRESHOLD = "1.4";
    expect(getPastEventRejectionThreshold()).toBe(0.5);
    process.env.INGESTION_PAST_DATE_REJECTION_THRESHOLD = "not-a-number";
    expect(getPastEventRejectionThreshold()).toBe(0.5);
  });
});

describe("geocodificação regional", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retorna coordenadas regionais do primeiro provider válido", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([
      { lat: "-23.9608", lon: "-46.3336", display_name: "Ativa House, Santos - SP", importance: 0.7, address: { neighbourhood: "Centro" } },
    ]), { status: 200, headers: { "content-type": "application/json" } }));
    const result = await resolveRegionalCoordinates({ locationName: "Ativa House", address: "Rua Teste, 100", city: "Santos" });
    expect(result).toMatchObject({ latitude: "-23.9608", longitude: "-46.3336", provider: "nominatim-regional", confidence: "high" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("não retorna coordenadas fora da Baixada e tenta o fallback de provider", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ lat: "-22.90", lon: "-43.20", display_name: "Rio" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    const result = await resolveRegionalCoordinates({ locationName: "Local desconhecido", address: "Rua sem número", city: "Guarujá" });
    expect(result).toBeNull();
  });
});
