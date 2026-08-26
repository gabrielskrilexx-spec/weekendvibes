const isProduction = process.env.NODE_ENV === "production";
let allowSandboxMocks = !isProduction && process.env.ALLOW_SANDBOX_MOCKS !== "false";

export function getSandboxMockSettings() {
  return { allowSandboxMocks: isProduction ? false : allowSandboxMocks, environment: isProduction ? "production" as const : "preview" as const };
}

export function setSandboxMocksAllowed(allowed: boolean) {
  if (isProduction) return getSandboxMockSettings();
  allowSandboxMocks = allowed;
  return getSandboxMockSettings();
}

export function shouldUseSandboxMocks() {
  return !isProduction && allowSandboxMocks;
}
