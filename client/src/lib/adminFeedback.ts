export function friendlyAdminErrorMessage(
  error: unknown,
  fallback: string
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = raw.toLowerCase();

  if (/unauthorized|não autentic|sessão|login|session/.test(normalized)) {
    return "Sua sessão administrativa expirou. Entre novamente para continuar.";
  }
  if (
    /forbidden|não autorizado|administrador|permission|permiss/.test(normalized)
  ) {
    return "Você não tem permissão para executar esta ação.";
  }
  if (/403|bloquead|proxy|rate limit/.test(normalized)) {
    return "A fonte bloqueou temporariamente a comunicação. Tente novamente em alguns instantes.";
  }
  if (
    /timeout|network|fetch|transport|transform|502|503|500|unavailable|indisponível|conexão|connection/.test(
      normalized
    )
  ) {
    return "Não foi possível comunicar com o servidor. Verifique a conexão e tente novamente.";
  }

  return fallback;
}

export function toastDescription(error: unknown, fallback: string): string {
  return friendlyAdminErrorMessage(error, fallback).slice(0, 240);
}

export function isAdminSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const data = (error as { data?: unknown }).data;
  const code =
    data && typeof data === "object" && "code" in data
      ? String((data as { code?: unknown }).code ?? "")
      : "";
  const raw = error instanceof Error ? error.message : String(error);
  return /UNAUTHORIZED|FORBIDDEN|401|403|unauthorized|forbidden|sessão|session|login|permission|permissão/i.test(
    `${code} ${raw}`
  );
}
