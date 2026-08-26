import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

type LogsData = {
  updatedAt: string;
  isLive: boolean;
  logs: Array<{
    id: string;
    runId: string;
    kind: string;
    timestamp: string;
    label: string;
    status: string;
    sourceKey: string | null;
    message: string | null;
  }>;
};

const state = vi.hoisted(() => ({
  query: {
    data: {
      updatedAt: "2026-08-26T17:00:00.000Z",
      isLive: true,
      logs: [
        {
          id: "run-42-finished",
          runId: "42",
          kind: "ingestion",
          timestamp: "2026-08-26T16:59:00.000Z",
          label: "public-agenda terminou",
          status: "succeeded",
          sourceKey: "public:blackpass",
          message: null,
        },
        {
          id: "run-42-retry-0",
          runId: "42",
          kind: "retry",
          timestamp: "2026-08-26T16:58:00.000Z",
          label: "public-agenda retry 1",
          status: "retry",
          sourceKey: "public:blackpass",
          message: "timeout temporário",
        },
      ],
    } as LogsData | undefined,
    error: null as Error | null,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ingestionReports: {
      logs: { useQuery: () => state.query },
    },
  },
}));

vi.mock("@/components/AdminAuthRecoveryDialog", () => ({
  default: () => null,
}));

import AdminLiveLogsPanel from "./AdminLiveLogsPanel";

describe("AdminLiveLogsPanel", () => {
  it("exibe o status ao vivo e eventos sanitizados por execução", () => {
    const markup = renderToStaticMarkup(<AdminLiveLogsPanel />);
    expect(markup).toContain("Logs em tempo real");
    expect(markup).toContain("Atualização ativa");
    expect(markup).toContain("public-agenda terminou");
    expect(markup).toContain("public:blackpass");
    expect(markup).toContain("timeout temporário");
    expect(markup).toContain("run 42");
  });

  it("exibe skeleton durante a consulta inicial", () => {
    state.query.isLoading = true;
    state.query.data = undefined;
    const markup = renderToStaticMarkup(<AdminLiveLogsPanel />);
    expect(markup).toContain('data-testid="admin-live-logs-skeleton"');
    state.query.isLoading = false;
  });
});
