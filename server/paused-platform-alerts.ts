export type CooldownSource = {
  sourceKey: string;
  lastFailureReason: string | null;
  circuitState: string;
  circuitNextAttemptAt: Date | null;
};

export type CooldownAlert = {
  alertType: string;
  title: string;
  message: string;
  isResolved: number;
};

export function activePlatformCooldownSourceKeys(sources: readonly CooldownSource[], now: Date): Set<string> {
  return new Set(sources.filter(source =>
    source.lastFailureReason === "BLOCKED_BY_PLATFORM"
    && source.circuitState === "open"
    && source.circuitNextAttemptAt instanceof Date
    && Number.isFinite(source.circuitNextAttemptAt.getTime())
    && source.circuitNextAttemptAt.getTime() > now.getTime()
  ).map(source => source.sourceKey));
}

export function partitionPlatformCooldownAlerts<T extends CooldownAlert>(alerts: readonly T[], pausedSourceKeys: ReadonlySet<string>) {
  const paused = (alert: CooldownAlert) => {
    const isWafBlock = alert.alertType === "source_http_403_blocked"
      || /BLOCKED_BY_PLATFORM/.test(`${alert.title} ${alert.message}`);
    if (!isWafBlock) return false;
    const content = `${alert.title} ${alert.message}`;
    return Array.from(pausedSourceKeys).some(sourceKey => content.includes(sourceKey));
  };
  const pausedAlerts = alerts.filter(paused);
  return {
    activeAlerts: alerts.filter(alert => !paused(alert)),
    pausedCount: pausedAlerts.filter(alert => alert.isResolved === 0).length,
  };
}
