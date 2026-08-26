const DEFAULT_USER_AGENT = "WeekendVibesBot/1.0 (+public-event-ingestion)";

export class ExternalFetchError extends Error {
  readonly statusCode: number | null;
  readonly code: "HTTP_ERROR" | "NETWORK_ERROR" | "TIMEOUT";

  constructor(message: string, code: ExternalFetchError["code"], statusCode: number | null = null) {
    super(message);
    this.name = "ExternalFetchError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isAbortError(error: unknown) {
  return Boolean(error && typeof error === "object" && "name" in error && String((error as { name?: unknown }).name) === "AbortError");
}

export async function fetchExternal(url: string, init: RequestInit = {}, timeoutMs = 12_000, allowHttpError = false): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", DEFAULT_USER_AGENT);
  if (!headers.has("accept")) headers.set("accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1");

  try {
    const response = await fetch(url, { ...init, headers, signal: controller.signal });
    if (!response.ok && !allowHttpError) {
      throw new ExternalFetchError(`Fonte externa respondeu HTTP ${response.status}`, "HTTP_ERROR", response.status);
    }
    return response;
  } catch (error) {
    if (error instanceof ExternalFetchError) throw error;
    if (isAbortError(error)) throw new ExternalFetchError(`Tempo limite de ${timeoutMs} ms excedido na fonte externa`, "TIMEOUT");
    throw new ExternalFetchError("Não foi possível conectar à fonte externa", "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

export async function readExternalBody(response: Response) {
  try {
    return await response.text();
  } catch {
    throw new ExternalFetchError("A fonte externa retornou um corpo inválido", "NETWORK_ERROR", response.status);
  }
}

export function isBlockedExternalResponse(status: number | null, body = "") {
  return status === 403 || status === 429 || status === 502 || status === 503 || status === 504 || /cloudflare|access denied|captcha|challenge|proxy error|bad gateway/i.test(body.slice(0, 2000));
}

export function isSandboxRestrictedError(error: unknown) {
  if (process.env.NODE_ENV === "production") return false;
  if (error instanceof ExternalFetchError) return error.code === "NETWORK_ERROR" || error.code === "TIMEOUT";
  const message = String(error instanceof Error ? error.message : error ?? "");
  return /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|timeout|timed out|proxy/i.test(message);
}

export function sanitizeExternalFetchError(error: unknown) {
  const status = error && typeof error === "object" && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : null;
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "NETWORK_ERROR";
  const message = error instanceof ExternalFetchError ? error.message : "Não foi possível comunicar com a fonte externa";
  return { status: status !== null && Number.isInteger(status) && status > 0 ? status : null, code, message: message.slice(0, 240) };
}
