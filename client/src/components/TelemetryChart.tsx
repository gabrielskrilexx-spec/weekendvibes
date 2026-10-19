import React from "react";
import { Download, LineChart as LineChartIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TelemetryPoint, TelemetryTrend } from "../../../shared/domain";

function trendLabel(trend: TelemetryTrend | undefined) {
  if (!trend) return "Comparativo indisponível";
  const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  return `${arrow} ${Math.abs(trend.percentage)}% vs período anterior`;
}
function trendClass(trend: TelemetryTrend | undefined) {
  if (!trend || trend.direction === "flat") return "text-zinc-400";
  return trend.direction === "up" ? "text-emerald-200" : "text-rose-200";
}

export default function TelemetryChart({ period, onPeriodChange, series, successTrend, onExport }: { period: 7 | 14 | 30; onPeriodChange: (period: 7 | 14 | 30) => void; series: TelemetryPoint[]; successTrend?: TelemetryTrend; onExport: (format: "csv" | "json") => void }) {
  return <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4" data-testid="telemetry-history-chart" aria-label="Histórico de telemetria">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2"><LineChartIcon size={16} className="text-emerald-200" aria-hidden="true" /><div><p className="text-sm font-black text-white">Histórico de telemetria</p><p className="text-xs text-zinc-500">Últimos {period} dias: falhas por categoria e taxa de sucesso.</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Período<select aria-label="Período do gráfico de telemetria" value={period} onChange={event => onPeriodChange(Number(event.target.value) as 7 | 14 | 30)} className="ml-2 min-h-9 rounded-lg border border-white/10 bg-zinc-900 px-2 text-xs normal-case tracking-normal text-white"><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option></select></label><button type="button" onClick={() => onExport("csv")} aria-label="Exportar série de telemetria em CSV" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs font-bold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><Download size={13} aria-hidden="true" /> CSV</button><button type="button" onClick={() => onExport("json")} aria-label="Exportar série de telemetria em JSON" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs font-bold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><Download size={13} aria-hidden="true" /> JSON</button></div>
      <p className={`text-xs font-bold ${trendClass(successTrend)}`}>Sucesso {successTrend?.current ?? "—"}% {trendLabel(successTrend)}</p>
    </div>
    <div className="mt-3 h-64 w-full" role="img" aria-label="Gráfico de linhas de WAF, Meta Code 110, rede e sucesso">{typeof ResizeObserver === "undefined" ? <p className="flex h-full items-center justify-center text-xs text-zinc-500">Gráfico disponível no navegador.</p> : <ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" /><XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 10 }} tickFormatter={value => String(value).slice(5)} /><YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} /><Line type="monotone" dataKey="waf" name="WAF" stroke="#38bdf8" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="meta110" name="Meta 110" stroke="#c084fc" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="network" name="Rede/Timeout" stroke="#fbbf24" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="successRate" name="Sucesso %" stroke="#34d399" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>}</div>
  </div>;
}
