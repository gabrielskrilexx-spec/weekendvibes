import { afterEach, describe, expect, it, vi } from "vitest";
import { appVersionResponse } from "./app-version";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});


describe("public app version", () => {
  it("retorna a versão configurada diretamente, sem abrir conexão HTTP", () => {
    vi.stubEnv("VITE_APP_VERSION", "4a464f29");
    const response = appVersionResponse(process.env.VITE_APP_VERSION);
    expect(response).toEqual({ status: 200, body: { version: "4a464f29" } });
  });

  it("usa fallback quando a versão não foi configurada", () => {
    const response = appVersionResponse(undefined);
    expect(response.body.version).toBe("unknown");
  });
});
