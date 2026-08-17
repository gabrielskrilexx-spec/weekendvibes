import { beforeEach, describe, expect, it, vi } from "vitest";
import { acceptLegalTerms, hasAcceptedLegalTerms, LEGAL_ACCEPTANCE_VERSION, startLogin } from "./const";

function installWindow(storageValue: string | null = null) {
  const storage = {
    value: storageValue,
    getItem: vi.fn(() => storage.value),
    setItem: vi.fn((_key: string, value: string) => { storage.value = value; }),
  };
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent });
  return { storage, dispatchEvent };
}

describe("legal login consent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("considera aceito apenas o versionamento legal atual", () => {
    installWindow(LEGAL_ACCEPTANCE_VERSION);
    expect(hasAcceptedLegalTerms()).toBe(true);
    installWindow("old-version");
    expect(hasAcceptedLegalTerms()).toBe(false);
  });

  it("persiste somente a versão atual ao aceitar", () => {
    const { storage } = installWindow();
    acceptLegalTerms();
    expect(storage.setItem).toHaveBeenCalledWith("weekendvibes:legal-acceptance", LEGAL_ACCEPTANCE_VERSION);
    expect(hasAcceptedLegalTerms()).toBe(true);
  });

  it("bloqueia o início do OAuth e solicita o aceite quando não há consentimento", () => {
    const { dispatchEvent } = installWindow();
    startLogin("/admin");
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0][0].type).toBe("weekendvibes:legal-consent-required");
  });
});
