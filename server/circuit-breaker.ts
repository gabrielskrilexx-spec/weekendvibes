import { getCircuitBreakerStatus, recordCircuitFailure, recordSource403Failure, recordCircuitSuccess, resetSource403State } from "./db.js";

const HTTP_403_ALERT_THRESHOLD = 3;

function severeFailureThreshold() {
  const configured = Number(process.env.INGESTION_CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? 3);
  return Number.isFinite(configured) ? Math.min(10, Math.max(2, Math.trunc(configured))) : 3;
}

export function isSevereCircuitFailure(input: { status?: number; message: string }) {
  if (input.status === 400 && /Token da Meta Expirado|META_INSTAGRAM_TOKEN|Meta Graph API.*credencial/i.test(input.message)) return false;
  return input.status === 401 || input.status === 403 || /session|cookie|credential|authentication/i.test(input.message);
}

export type CircuitFailureKind = "proxy_or_session" | "upstream";
export type CircuitMachineState = "closed" | "open" | "half_open";

export class CircuitBreakerMachine {
  private state: CircuitMachineState = "closed";
  private failureCount = 0;
  private nextAttemptAt: Date | null = null;

  constructor(private readonly threshold = 3, private readonly cooldownMs = 18 * 60 * 60 * 1000) {}

  snapshot() {
    return { state: this.state, failureCount: this.failureCount, nextAttemptAt: this.nextAttemptAt };
  }

  canAttempt(now = new Date()) {
    if (this.state === "open" && this.nextAttemptAt && now.getTime() < this.nextAttemptAt.getTime()) return false;
    if (this.state === "open") this.state = "half_open";
    return true;
  }

  recordFailure(now = new Date()) {
    this.failureCount = this.state === "half_open" ? this.threshold : this.failureCount + 1;
    if (this.failureCount >= this.threshold) {
      this.state = "open";
      this.nextAttemptAt = new Date(now.getTime() + this.cooldownMs);
      return { ...this.snapshot(), openedNow: true };
    }
    return { ...this.snapshot(), openedNow: false };
  }

  recordSuccess() {
    this.state = "closed";
    this.failureCount = 0;
    this.nextAttemptAt = null;
    return this.snapshot();
  }
}

export function buildCircuitOpenedPayload(input: { sourceKey: string; routine: string; nextAttemptAt: Date; failureCount: number; message: string }) {
  return {
    type: "circuit_opened",
    routine: input.routine.slice(0, 64),
    sourceKey: input.sourceKey.slice(0, 120),
    failureCount: input.failureCount,
    nextAttemptAt: input.nextAttemptAt.toISOString(),
    message: input.message.replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]").slice(0, 500),
  };
}

export async function notifyCircuitOpened(payload: ReturnType<typeof buildCircuitOpenedPayload>) {
  const endpoint = process.env.CRITICAL_ALERT_WEBHOOK_URL?.trim();
  if (!endpoint) return false;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(payload) });
    return response.ok;
  } catch (error) {
    console.warn("[CircuitBreaker] webhook unavailable; continuing safely", { message: error instanceof Error ? error.message.slice(0, 180) : "unknown_error" });
    return false;
  }
}

export async function allowSourceAttempt(sourceKey: string) {
  return getCircuitBreakerStatus(sourceKey);
}

export async function registerSourceFailure(input: { sourceKey: string; routine: string; status?: number; message: string }) {
  const is403 = input.status === 403;
  const severe = isSevereCircuitFailure(input);
  const now = new Date();
  const source403 = is403
    ? await recordSource403Failure(input.sourceKey, severeFailureThreshold(), now)
    : !severe
      ? (await resetSource403State(input.sourceKey, now), { count: 0, shouldAlert: false })
      : { count: 0, shouldAlert: false };
  const result = await recordCircuitFailure(input.sourceKey, input.message, input.status, now, undefined, severe);
  if (result.openedNow && result.nextAttemptAt) {
    const payload = buildCircuitOpenedPayload({ sourceKey: input.sourceKey, routine: input.routine, nextAttemptAt: result.nextAttemptAt, failureCount: result.failureCount, message: input.message });
    await notifyCircuitOpened(payload);
  }
  if (is403 && source403.shouldAlert) {
    await notifyCircuitOpened({ type: "source_http_403_blocked", routine: input.routine.slice(0, 64), sourceKey: input.sourceKey.slice(0, 120), failureCount: source403.count, nextAttemptAt: new Date().toISOString(), message: `A fonte ${input.sourceKey} respondeu HTTP 403 em ${source403.count} falhas consecutivas.` });
  }
  return result;
}

export async function registerSourceSuccess(sourceKey: string) {
  await resetSource403State(sourceKey);
  await recordCircuitSuccess(sourceKey);
}
