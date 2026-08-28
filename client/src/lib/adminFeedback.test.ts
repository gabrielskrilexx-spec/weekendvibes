import { describe, expect, it } from "vitest";
import { friendlyAdminErrorMessage } from "./adminFeedback";

describe("friendlyAdminErrorMessage", () => {
  it("translates transport failures into an actionable message", () => {
    expect(
      friendlyAdminErrorMessage(
        new Error("Unable to transform response from server"),
        "fallback"
      )
    ).toBe(
      "Não foi possível comunicar com o servidor. Verifique a conexão e tente novamente."
    );
    expect(
      friendlyAdminErrorMessage(
        new Error("fetch failed with HTTP 403"),
        "fallback"
      )
    ).toContain("bloqueou temporariamente");
  });

  it("maps typed REST authorization failures to friendly messages", () => {
    expect(friendlyAdminErrorMessage({ status: 401, code: "UNAUTHORIZED", message: "unauthorized" }, "fallback")).toContain("sessão administrativa expirou");
    expect(friendlyAdminErrorMessage({ status: 403, code: "FORBIDDEN", message: "forbidden" }, "fallback")).toContain("não tem permissão");
  });

  it("does not expose raw upstream details for session or unknown failures", () => {
    expect(
      friendlyAdminErrorMessage(
        new Error("UNAUTHORIZED: token=secret"),
        "fallback"
      )
    ).toContain("sessão administrativa expirou");
    expect(
      friendlyAdminErrorMessage(new Error("unexpected"), "Mensagem segura")
    ).toBe("Mensagem segura");
  });
});
