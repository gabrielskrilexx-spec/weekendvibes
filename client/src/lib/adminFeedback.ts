type ErrorRecord = Record<string, unknown>;

function asRecord(value: unknown): ErrorRecord | null {
  return value && typeof value === "object" ? value as ErrorRecord : null;
}

function numericValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(parsed) ? parsed : 0;
}

function getErrorMetadata(error: unknown) {
  const root = asRecord(error);
  const data = asRecord(root?.data);
  const shape = asRecord(root?.shape);
  const shapeData = asRecord(shape?.data);
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const status = [root?.status, root?.httpStatus, data?.status, data?.httpStatus, shape?.status, shapeData?.status, shapeData?.httpStatus]
    .map(numericValue)
    .find(Boolean) ?? 0;
  const code = [root?.code, data?.code, shape?.code, shapeData?.code]
    .filter(value => typeof value === "string")
    .map(value => String(value).toLowerCase())
    .find(Boolean) ?? "";
  return { raw, normalized: raw.toLowerCase(), status, code, searchable: `${raw} ${code}`.toLowerCase() };
}

export function friendlyAdminErrorMessage(error: unknown, fallback: string): string {
  const { normalized, status, code, searchable } = getErrorMetadata(error);

  if (status === 401 || /\b401\b|unauthorized|não autentic|sessão|login|session/.test(searchable)) {
    return "Sua sessão administrativa está ausente ou expirada. Entre novamente para continuar.";
  }
  if (code === "precondition_failed" || /reativação bloqueada/.test(normalized)) {
    return "A reativação desta fonte exige uma validação Meta bem-sucedida. Os demais parâmetros continuam editáveis enquanto ela estiver pausada.";
  }
  if (status === 403 || /\b403\b|forbidden|não autorizado|administrador|permission|permiss/.test(searchable)) {
    return "Você está autenticado, mas não tem permissão administrativa para consultar este relatório.";
  }
  if (status === 503 || /\b503\b|service[_ -]?unavailable|indisponibilidade|serviço indisponível|banco indisponível/.test(searchable)) {
    return "O serviço ou banco de dados está indisponível no momento. A consulta não foi concluída; tente novamente em instantes.";
  }
  if (/timeout|network|fetch|transport|transform|conexão|connection|\b502\b|\b504\b/.test(searchable)) {
    return "Não foi possível comunicar com o servidor durante a consulta (falha de rede ou transporte). Verifique a conexão e tente novamente.";
  }
  if ((status >= 500 && status <= 599) || /consulta|query|internal server error|\b500\b/.test(searchable)) {
    return "A consulta do relatório falhou no servidor. Tente novamente; os dados não foram tratados como vazios.";
  }

  return fallback;
}

export function toastDescription(error: unknown, fallback: string): string {
  return friendlyAdminErrorMessage(error, fallback).slice(0, 240);
}

export function isAdminSessionError(error: unknown): boolean {
  const { searchable, status } = getErrorMetadata(error);
  return status === 401 || status === 403 || /unauthorized|forbidden|\b401\b|\b403\b|sessão|session|login|permission|permissão/.test(searchable);
}
