export const RunStatus = {
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  PARTIAL: "partial",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const SourceHealth = {
  NEVER: "never",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;
export type SourceHealth = (typeof SourceHealth)[keyof typeof SourceHealth];

export const CircuitState = {
  CLOSED: "closed",
  OPEN: "open",
  HALF_OPEN: "half_open",
} as const;
export type CircuitState = (typeof CircuitState)[keyof typeof CircuitState];

export const FailureCategory = {
  WAF: "waf",
  META_110: "meta110",
  NETWORK: "network",
  PARSER: "parser",
  SUCCESS: "success",
} as const;
export type FailureCategory = (typeof FailureCategory)[keyof typeof FailureCategory];

export const JsonContractVersion = 1 as const;

export type TelemetryPoint = {
  date: string;
  waf: number;
  meta110: number;
  network: number;
  succeeded: number;
  total: number;
  successRate: number;
};

export type TelemetryTrend = {
  current: number;
  previous: number;
  percentage: number;
  direction: "up" | "down" | "flat";
};
