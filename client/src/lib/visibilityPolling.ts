export type VisibilityEnvironment = {
  visibilityState?: string;
};

export function getVisibilityAwarePollingInterval(
  baseMs: number,
  options: { jitterRatio?: number; environment?: VisibilityEnvironment } = {},
): number | false {
  const environment = options.environment ?? (typeof document === "undefined" ? {} : document);
  if (environment.visibilityState === "hidden") return false;

  const safeBase = Math.max(250, Math.round(baseMs));
  const jitterRatio = Math.min(0.25, Math.max(0, options.jitterRatio ?? 0.1));
  if (jitterRatio === 0) return safeBase;

  const jitter = (Math.random() * 2 - 1) * safeBase * jitterRatio;
  return Math.max(250, Math.round(safeBase + jitter));
}

export function shouldPollWhenVisible(environment: VisibilityEnvironment = typeof document === "undefined" ? {} : document) {
  return environment.visibilityState !== "hidden";
}
