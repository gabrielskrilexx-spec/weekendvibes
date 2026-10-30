import { runPublicAgendaStep } from "../server/agenda-routine";
import { listIngestionSources } from "../server/db";

const CURVAO_ZIG_SOURCE_KEYS = [
  "public:curvao-halloween-na-curvao",
  "public:curvao-house-night-joni",
  "public:curvao-rotations-sessions",
  "public:zig:reveillon-curvao-2027",
] as const;

const rows = await listIngestionSources();
const byKey = new Map(rows.map(source => [source.sourceKey, source]));
const missing = CURVAO_ZIG_SOURCE_KEYS.filter(sourceKey => {
  const source = byKey.get(sourceKey);
  return !source || source.kind !== "public" || source.isEnabled !== 1 || !source.url;
});
if (missing.length > 0) {
  throw new Error(`Fontes públicas do Curvão ausentes ou desabilitadas no Neon: ${missing.join(", ")}`);
}

const sources = CURVAO_ZIG_SOURCE_KEYS.map(sourceKey => byKey.get(sourceKey)!);
const result = await runPublicAgendaStep({
  track: true,
  sourceKey: "public:zig",
  sourceUrls: sources.map(source => source.url),
  archive: false,
  trigger: "manual",
});

console.log(JSON.stringify({
  routine: "public-agenda",
  scope: "curvao-zig",
  sourceKeys: sources.map(source => source.sourceKey),
  sourceUrls: sources.map(source => source.url),
  archived: result.archived,
  expiredSources: result.expiredSources,
  result: result.result,
}, null, 2));
