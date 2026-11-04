import { archivePastEvents } from "../server/db";

async function main() {
  const archived = await archivePastEvents();
  console.log(JSON.stringify({
    ok: true,
    routine: "maintenance:archive-past-events",
    timezone: "America/Sao_Paulo",
    archived,
  }, null, 2));
}

main().catch(error => {
  const name = error && typeof error === "object" && "name" in error
    ? String((error as { name?: unknown }).name ?? "Error")
    : "Error";
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  console.error(JSON.stringify({ ok: false, error: name, ...(code ? { code } : {}) }));
  process.exitCode = 1;
});
