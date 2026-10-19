import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { FailureCategory } from "../../../shared/domain";

export type FailureFilter = "all" | Extract<FailureCategory, "waf" | "meta110" | "network">;
export type PeriodFilter = "all" | "7d" | "30d";

export function useAdminSources() {
  const [openOnly, setOpenOnly] = useState(false);
  const [failureFilter, setFailureFilter] = useState<FailureFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [graphPeriod, setGraphPeriod] = useState<7 | 14 | 30>(14);
  const filterSince = useMemo(() => periodFilter === "all" ? undefined : new Date(Date.now() - (periodFilter === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString(), [periodFilter]);
  const sources = trpc.ingestionSources.list.useQuery({ openOnly: openOnly || undefined, failureCategory: failureFilter === "all" ? undefined : failureFilter, since: filterSince }, { refetchInterval: 30_000 });
  const sourceSummary = trpc.ingestionSources.summary.useQuery(undefined, { refetchInterval: 30_000 });
  const consolidatedReport = trpc.ingestionSources.consolidatedReport.useQuery(undefined, { enabled: false });
  const consolidatedCsvExport = trpc.ingestionSources.consolidatedCsvExport.useQuery(undefined, { enabled: false });
  const executiveReport = trpc.ingestionSources.executiveReport.useQuery({ days: graphPeriod }, { refetchInterval: 60_000 });
  const mockSettings = trpc.ingestionReports.mockSettings.useQuery(undefined, { refetchInterval: 30_000 });
  return { openOnly, setOpenOnly, failureFilter, setFailureFilter, periodFilter, setPeriodFilter, graphPeriod, setGraphPeriod, sources, sourceSummary, consolidatedReport, consolidatedCsvExport, executiveReport, mockSettings };
}
