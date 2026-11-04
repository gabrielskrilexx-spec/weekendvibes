export type PlatformCooldownSource = {
  sourceKey: string;
  circuitState: string;
  circuitNextAttemptAt?: string | Date | null;
  lastFailureReason?: string | null;
};

export type OperationalAlertLike = {
  alertType?: string | null;
  title: string;
  message: string;
};

export function isPlatformCooldownActive(source: PlatformCooldownSource, now: Date): boolean {
  const nextAttempt = source.circuitNextAttemptAt == null ? NaN : new Date(source.circuitNextAttemptAt).getTime();
  return source.lastFailureReason === "BLOCKED_BY_PLATFORM"
    && source.circuitState === "open"
    && Number.isFinite(nextAttempt)
    && nextAttempt > now.getTime();
}

export function isAlertPausedForPlatformCooldown(alert: OperationalAlertLike, pausedSourceKeys: ReadonlySet<string>): boolean {
  if (pausedSourceKeys.size === 0) return false;
  const sourceHttpAlert = alert.alertType === "source_http_403_blocked" || /BLOCKED_BY_PLATFORM/.test(`${alert.title} ${alert.message}`);
  if (!sourceHttpAlert) return false;
  const text = `${alert.title} ${alert.message}`;
  return Array.from(pausedSourceKeys).some(sourceKey => text.includes(sourceKey));
}
