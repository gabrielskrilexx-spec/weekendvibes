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
  const status = error && typeof error === "object" && "status" in error ? Number((error as { status?: unknown }).status) : 0;
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "").toLowerCase() : "";

  if (status === 401 || /unauthorized|não autentic|sessão|login|session/.test(`${normalized} ${code}`)) {
    return "Sua sessão administrativa expirou. Entre novamente para continuar.";
  }
  if (
    status === 403 || /forbidden|não autorizado|administrador|permission|permiss/.test(`${normalized} ${code}`)
  ) {
    return "Você não tem permissão para executar esta ação.";
  }
  if (/403|bloquead|proxy|rate limit|sandbox_restricted/.test(`${normalized} ${code}`)) {
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
  const status = "status" in error ? Number((error as { status?: unknown }).status) : 0;
  const directCode = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (status === 401 || status === 403 || /UNAUTHORIZED|FORBIDDEN/i.test(directCode)) return true;
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
