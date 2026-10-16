#!/usr/bin/env node
/**
 * Monitor público e não invasivo das páginas oficiais de eventos.
 * Não usa login, cookies, proxy, CAPTCHA, TLS impersonation ou persistência.
 */

const { runTicketingMonitorOnce, runTicketingMonitorWatch } = await import("../server/ticketing-monitor.ts");

const timeoutMs = Math.min(30_000, Math.max(3_000, Number(process.env.MONITOR_TIMEOUT_MS || 15_000)));
const intervalMs = Math.max(60_000, Number(process.env.MONITOR_INTERVAL_MS || 900_000));

if (process.argv.includes("--watch") || process.env.MONITOR_WATCH === "1") {
  await runTicketingMonitorWatch({ timeoutMs, intervalMs });
} else {
  console.log(JSON.stringify(await runTicketingMonitorOnce({ timeoutMs })));
}
