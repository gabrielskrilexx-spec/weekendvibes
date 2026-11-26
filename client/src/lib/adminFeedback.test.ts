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
      "Não foi possível comunicar com o servidor durante a consulta (falha de rede ou transporte). Verifique a conexão e tente novamente."
    );
    expect(
      friendlyAdminErrorMessage(
        new Error("fetch failed with HTTP 403"),
        "fallback"
      )
    ).toContain("não tem permissão");
  });

  it("maps typed REST authorization failures to friendly messages", () => {
    expect(friendlyAdminErrorMessage({ status: 401, code: "UNAUTHORIZED", message: "unauthorized" }, "fallback")).toContain("ausente ou expirada");
    expect(friendlyAdminErrorMessage({ status: 403, code: "FORBIDDEN", message: "forbidden" }, "fallback")).toContain("não tem permissão");
  });

  it("reconhece códigos e status aninhados no formato tRPC", () => {
    expect(friendlyAdminErrorMessage({ shape: { data: { code: "UNAUTHORIZED", httpStatus: 401 } } }, "fallback")).toContain("ausente ou expirada");
    expect(friendlyAdminErrorMessage({ data: { code: "FORBIDDEN", httpStatus: 403 } }, "fallback")).toContain("autenticado, mas não tem permissão");
    expect(friendlyAdminErrorMessage({ data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503 } }, "fallback")).toContain("banco de dados está indisponível");
  });

  it("diferencia indisponibilidade de um erro desconhecido", () => {
    expect(friendlyAdminErrorMessage({ status: 503, message: "database unavailable" }, "fallback")).toContain("consulta não foi concluída");
    expect(friendlyAdminErrorMessage(new Error("unexpected"), "Mensagem segura")).toBe("Mensagem segura");
  });

  it("preserva o diagnóstico técnico PostgreSQL no final da mensagem", () => {
    expect(friendlyAdminErrorMessage({ status: 503, message: "O serviço está indisponível (PG:42703)." }, "fallback"))
      .toMatch(/consulta não foi concluída.*\[PG:42703\]$/);
    expect(friendlyAdminErrorMessage({ status: 503, message: "O serviço está indisponível (PG:42703:column_missing)." }, "fallback"))
      .toMatch(/consulta não foi concluída.*\[PG:42703:COLUMN_MISSING\]$/);
    expect(friendlyAdminErrorMessage({ status: 503, message: "Falha técnica [ERR:QUERY:invalid_date_param]" }, "fallback"))
      .toMatch(/consulta não foi concluída.*\[ERR:QUERY:INVALID_DATE_PARAM\]$/);
    expect(friendlyAdminErrorMessage({ status: 503, message: "Falha técnica [ERR:connection]" }, "fallback"))
      .toMatch(/consulta não foi concluída.*\[ERR:CONNECTION\]$/);
  });

  it("does not present a protected Meta reactivation as a communication block", () => {
    expect(friendlyAdminErrorMessage({ status: 403, code: "PRECONDITION_FAILED", message: "Reativação bloqueada: OAuthException code 110" }, "fallback")).toContain("validação Meta bem-sucedida");
  });

  it("does not expose raw upstream details for session or unknown failures", () => {
    expect(
      friendlyAdminErrorMessage(
        new Error("UNAUTHORIZED: token=secret"),
        "fallback"
      )
    ).toContain("ausente ou expirada");
    expect(
      friendlyAdminErrorMessage(new Error("unexpected"), "Mensagem segura")
    ).toBe("Mensagem segura");
  });
});
