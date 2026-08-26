import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({
  mutation: {
    data: {
      dryRun: true,
      startedAt: "2026-08-25T12:00:00.000Z",
      finishedAt: "2026-08-25T12:00:01.000Z",
      durationMs: 1000,
      sources: [
        {
          routine: "public-agenda",
          sourceKey: "public:blackpass",
          durationMs: 320,
          medianDurationMs: 280,
          p95DurationMs: 410,
          read: 5,
          filtered: 4,
          persistable: 1,
          duplicates: 0,
          errors: [{ status: 502, message: "Fonte pública indisponível" }],
          rejectionReasons: {
            fetchFailed: 1,
            outsideTargetVenue: 3,
            invalidStructuredEvent: 0,
            duplicate: 0,
            pastEvent: 0,
          },
        },
      ],
      totals: {
        read: 5,
        filtered: 4,
        persistable: 1,
        duplicates: 0,
        errors: 1,
      },
    },
    error: null as Error | null,
    isPending: false,
    isError: false,
    mutate: vi.fn(),
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: { ingestionReports: { dryRun: { useMutation: () => state.mutation } } },
}));

import AdminDryRunPanel from "./AdminDryRunPanel";

describe("AdminDryRunPanel", () => {
  it("exibe skeleton enquanto o Dry-run está processando", () => {
    state.mutation.isPending = true;
    const markup = renderToStaticMarkup(<AdminDryRunPanel />);
    expect(markup).toContain('data-testid="dry-run-loading-skeleton"');
    expect(markup).toContain("Processando fontes e validando candidatos");
    state.mutation.isPending = false;
  });

  it("exibe uma mensagem amigável para falha de comunicação", () => {
    state.mutation.error = new Error(
      "Unable to transform response from server"
    );
    state.mutation.isError = true;
    const markup = renderToStaticMarkup(<AdminDryRunPanel />);
    expect(markup).toContain("Não foi possível comunicar com o servidor");
    state.mutation.error = null;
    state.mutation.isError = false;
  });

  it("exibe o disparo e o relatório por fonte sem sugerir persistência real", () => {
    const markup = renderToStaticMarkup(<AdminDryRunPanel />);
    expect(markup).toContain("Simular ingestão (Dry-run)");
    expect(markup).toContain("Black Pass");
    expect(markup).toContain("Seriam persistidos");
    expect(markup).toContain("Duração");
    expect(markup).toContain("320 ms");
    expect(markup).toContain("280 ms");
    expect(markup).toContain("410 ms");
    expect(markup).toContain("Ver detalhes dos erros (1)");
    expect(markup).toContain("Fonte pública indisponível");
    expect(markup).toContain("sem persistência");
  });
});
