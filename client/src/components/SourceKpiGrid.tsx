import React from "react";
import type { FailureCategory } from "../../../shared/domain";

type Trend = { current: number; percentage: number; direction: "up" | "down" | "flat" };
export type SourceKpiSummary = { active?: number; open?: number; waf?: number; meta110?: number; network?: number };
export type SourceKpiTrends = { waf: Trend; meta110: Trend; network: Trend; successRate: Trend };
const toneClasses = {
  emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  rose: "border-rose-300/20 bg-rose-400/10 text-rose-200",
  sky: "border-sky-300/20 bg-sky-400/10 text-sky-200",
  violet: "border-violet-300/20 bg-violet-400/10 text-violet-200",
  amber: "border-amber-300/20 bg-amber-400/10 text-amber-200",
} as const;

function trendLabel(trend: Trend | undefined) {
  if (!trend) return "Comparativo indisponível";
  const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  return `${arrow} ${Math.abs(trend.percentage)}% vs período anterior`;
}
function trendClass(trend: Trend | undefined, inverse = false) {
  if (!trend || trend.direction === "flat") return "text-zinc-400";
  const positive = inverse ? trend.direction === "down" : trend.direction === "up";
  return positive ? "text-emerald-200" : "text-rose-200";
}

export default function SourceKpiGrid({ summary, trends }: { summary?: SourceKpiSummary; trends?: SourceKpiTrends }) {
  const cards: Array<{ label: string; value: number | string; hint: string; tone: string; category?: FailureCategory; trend?: Trend; inverse?: boolean }> = [
    { label: "Fontes ativas", value: summary?.active ?? "—", hint: "Estado atual", tone: "emerald" },
    { label: "OPEN / pausadas", value: summary?.open ?? "—", hint: "Circuit breaker", tone: "rose" },
    { label: "Bloqueios WAF", value: trends?.waf.current ?? summary?.waf ?? "—", hint: trendLabel(trends?.waf), tone: "sky", category: "waf", trend: trends?.waf, inverse: true },
    { label: "Meta Code 110", value: trends?.meta110.current ?? summary?.meta110 ?? "—", hint: trendLabel(trends?.meta110), tone: "violet", category: "meta110", trend: trends?.meta110, inverse: true },
    { label: "Rede / timeout", value: trends?.network.current ?? summary?.network ?? "—", hint: trendLabel(trends?.network), tone: "amber", category: "network", trend: trends?.network, inverse: true },
  ];
  return <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Indicadores de governança" data-testid="ingestion-source-kpis">
    {cards.map(card => <div key={card.label} data-failure-category={card.category} className={`rounded-2xl border p-4 ${toneClasses[card.tone as keyof typeof toneClasses]}`}>
      <p className="text-[10px] font-black uppercase tracking-wider">{card.label}</p>
      <p className="mt-2 text-2xl font-black text-white">{card.value}</p>
      <p className={`mt-1 text-[10px] ${card.trend ? `font-bold ${trendClass(card.trend, card.inverse)}` : "text-zinc-400"}`}>{card.hint}</p>
    </div>)}
  </div>;
}
