import { readFileSync, writeFileSync } from "node:fs";

const sections = [
  ["package.json", "package.json"],
  ["Arquivo principal do servidor/API — server/_core/index.ts", "server/_core/index.ts"],
  ["Circuit breaker e gerenciamento de falhas — server/circuit-breaker.ts", "server/circuit-breaker.ts"],
  ["Extração pública — server/ingestion.ts", "server/ingestion.ts"],
  ["Rotina principal do Instagram — server/instagram-pipeline.ts", "server/instagram-pipeline.ts"],
  ["Fila de Revisão Manual — client/src/components/ManualReviewPanel.tsx", "client/src/components/ManualReviewPanel.tsx"],
];

const generatedAt = new Date().toISOString();
const output = [
  "# Auditoria estrutural — WeekendVibes",
  "",
  `Gerado em: ${generatedAt}`,
  "",
  "Este arquivo reúne cópias integrais dos arquivos-chave solicitados para revisão por outro engenheiro. Os blocos abaixo são delimitados por caminho e linguagem para facilitar leitura, cópia e comparação.",
  "",
  "## Índice",
  ...sections.map(([title, path], index) => `${index + 1}. [${title}](#${path.replaceAll(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase()})`),
  "",
];

for (const [title, path] of sections) {
  const content = readFileSync(path, "utf8");
  const language = path.endsWith(".json") ? "json" : path.endsWith(".tsx") ? "tsx" : "ts";
  output.push(`## ${title}`, "", `**Caminho:** \`${path}\``, "", `\u0060\u0060\u0060${language}`, content.replace(/```/g, "``\\`").replace(/\s+$/, ""), "```", "");
}

writeFileSync("auditoria_estrutural.md", `${output.join("\n")}\n`, "utf8");
console.log(`Wrote auditoria_estrutural.md with ${sections.length} complete file sections.`);
