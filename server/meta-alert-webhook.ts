export type CriticalMetaReason = "blocked_credentials" | "token_expired" | "invalid_token";

type FetchLike = typeof fetch;

export function buildCriticalMetaAlertPayload(input: { reason: CriticalMetaReason; occurredAt?: Date }) {
  const occurredAt = input.occurredAt ?? new Date();
  return {
    content: [
      "[WeekendVibes] Alerta crítico da integração Meta",
      `Tipo: ${input.reason}`,
      `Ocorrência: ${occurredAt.toISOString()}`,
      "Ação: realizar a renovação manual do token de acesso do Instagram.",
    ].join("\n"),
  };
}

const sentKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export async function sendCriticalMetaAlert(input: { reason: CriticalMetaReason; occurredAt?: Date; fetchImpl?: FetchLike }, webhookUrl = process.env.DISCORD_WEBHOOK_URL) {
  if (!webhookUrl) return { sent: false as const, reason: "missing_webhook" as const };
  if (!/^https:\/\/discord(?:app)?\.com\/api\/webhooks\//i.test(webhookUrl)) return { sent: false as const, reason: "invalid_webhook" as const };
  const occurredAt = input.occurredAt ?? new Date();
  const key = `${input.reason}:${Math.floor(occurredAt.getTime() / DEDUPE_WINDOW_MS)}`;
  const now = Date.now();
  sentKeys.forEach((timestamp, storedKey) => { if (now - timestamp > DEDUPE_WINDOW_MS) sentKeys.delete(storedKey); });
  if (sentKeys.has(key)) return { sent: false as const, reason: "deduplicated" as const };
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(buildCriticalMetaAlertPayload({ reason: input.reason, occurredAt })) });
  if (!response.ok) throw new Error(`Discord webhook failed with HTTP ${response.status}`);
  sentKeys.set(key, now);
  return { sent: true as const };
}

export function classifyCriticalMetaReason(details: unknown): CriticalMetaReason | null {
  const text = typeof details === "string" ? details : JSON.stringify(details ?? "");
  if (/blocked_credentials|token\s*(?:expired|invalid)|oauthexception[^\n]*(?:190|467)|\b(?:190|467)\b/i.test(text)) {
    if (/expired/i.test(text)) return "token_expired";
    if (/invalid|190|467/i.test(text)) return "invalid_token";
    return "blocked_credentials";
  }
  return null;
}
