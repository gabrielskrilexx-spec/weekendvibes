const DEFAULT_USER_AGENT = "WeekendVibesBot/1.0 (+public-event-ingestion)";

export class ExternalFetchError extends Error {
  readonly statusCode: number | null;
  readonly code: "HTTP_ERROR" | "NETWORK_ERROR" | "TIMEOUT";
  readonly attempts?: number;
  readonly retryable?: boolean;
  readonly retryAfterMs?: number;

  constructor(message: string, code: ExternalFetchError["code"], statusCode: number | null = null, metadata: { attempts?: number; retryable?: boolean; retryAfterMs?: number } = {}) {
    super(message);
    this.name = "ExternalFetchError";
    this.code = code;
    this.statusCode = statusCode;
    this.attempts = metadata.attempts;
    this.retryable = metadata.retryable;
    this.retryAfterMs = metadata.retryAfterMs;
  }
}

function isAbortError(error: unknown) {
  return Boolean(error && typeof error === "object" && "name" in error && String((error as { name?: unknown }).name) === "AbortError");
}

const pendingBodyTimeouts = new WeakMap<Response, { cleanup: () => void; didTimeout: () => boolean; timeoutMs: number }>();
export const EXTERNAL_FETCH_MAX_ATTEMPTS = 3;
export const EXTERNAL_FETCH_RETRY_DELAYS_MS = [300, 1_200] as const;

function sleep(delayMs: number) {
  return new Promise<void>(resolve => setTimeout(resolve, delayMs));
}

export function shouldRetryExternalFetch(error: unknown, externalSignal?: AbortSignal) {
  if (externalSignal?.aborted) return false;
  return error instanceof ExternalFetchError && (
    error.code === "NETWORK_ERROR" ||
    error.code === "TIMEOUT" ||
    (error.code === "HTTP_ERROR" && [502, 503, 504].includes(error.statusCode ?? 0))
  );
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(3_000, Math.max(0, seconds * 1_000));
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.min(3_000, Math.max(0, timestamp - Date.now())) : 0;
}

function retryDelayMs(attempt: number, retryAfter: number) {
  if (retryAfter > 0) return retryAfter;
  const base = EXTERNAL_FETCH_RETRY_DELAYS_MS[Math.min(attempt, EXTERNAL_FETCH_RETRY_DELAYS_MS.length - 1)] ?? 1_200;
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

export async function fetchExternal(url: string, init: RequestInit = {}, timeoutMs = 12_000, allowHttpError = false, externalSignal?: AbortSignal): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", DEFAULT_USER_AGENT);
  if (!headers.has("accept")) headers.set("accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1");

  let lastError: unknown;
  for (let attempt = 0; attempt < EXTERNAL_FETCH_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const abortFromCaller = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    };

    try {
      const response = await fetch(url, { ...init, headers, signal: controller.signal });
      if (!response.ok && !allowHttpError) {
        cleanup();
        throw new ExternalFetchError(`Fonte externa respondeu HTTP ${response.status}`, "HTTP_ERROR", response.status, { retryAfterMs: retryAfterMs(response) });
      }
      if (response.body) pendingBodyTimeouts.set(response, { cleanup, didTimeout: () => timedOut, timeoutMs });
      else cleanup();
      return response;
    } catch (error) {
      cleanup();
      if (error instanceof ExternalFetchError) {
        lastError = new ExternalFetchError(error.message, error.code, error.statusCode, { retryAfterMs: error.retryAfterMs, attempts: attempt + 1, retryable: shouldRetryExternalFetch(error, externalSignal) });
      } else if (isAbortError(error)) {
        lastError = new ExternalFetchError(`Tempo limite de ${timeoutMs} ms excedido na fonte externa`, "TIMEOUT", null, { attempts: attempt + 1, retryable: true });
      } else {
        lastError = new ExternalFetchError("Não foi possível conectar à fonte externa", "NETWORK_ERROR", null, { attempts: attempt + 1, retryable: true });
      }
      if (!shouldRetryExternalFetch(lastError, externalSignal) || attempt === EXTERNAL_FETCH_MAX_ATTEMPTS - 1) throw lastError;
      await sleep(retryDelayMs(attempt, lastError instanceof ExternalFetchError ? (lastError.retryAfterMs ?? 0) : 0));
    }
  }
  throw lastError instanceof Error ? lastError : new ExternalFetchError("Não foi possível conectar à fonte externa", "NETWORK_ERROR");
}

export async function readExternalBody(response: Response) {
  const pendingTimeout = pendingBodyTimeouts.get(response);
  try {
    return await response.text();
  } catch (error) {
    if (pendingTimeout?.didTimeout() || isAbortError(error)) {
      throw new ExternalFetchError(`Tempo limite de ${pendingTimeout?.timeoutMs ?? 12_000} ms excedido na leitura da fonte externa`, "TIMEOUT", response.status);
    }
    throw new ExternalFetchError("A fonte externa retornou um corpo inválido", "NETWORK_ERROR", response.status);
  } finally {
    pendingTimeout?.cleanup();
    pendingBodyTimeouts.delete(response);
  }
}

export function isBlockedExternalResponse(status: number | null, body = "") {
  return status === 403 || status === 429 || status === 502 || status === 503 || status === 504 || /cloudflare|access denied|captcha|challenge|proxy error|bad gateway/i.test(body.slice(0, 2000));
}

export function isSandboxRestrictedError(error: unknown) {
  if (process.env.NODE_ENV === "production") return false;
  if (error instanceof ExternalFetchError) {
    return error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" ||
      (error.code === "HTTP_ERROR" && isBlockedExternalResponse(error.statusCode));
  }
  const message = String(error instanceof Error ? error.message : error ?? "");
  return /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|timeout|timed out|proxy/i.test(message);
}

export function sanitizeExternalFetchError(error: unknown) {
  const status = error && typeof error === "object" && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : null;
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "NETWORK_ERROR";
  const message = error instanceof ExternalFetchError ? error.message : "Não foi possível comunicar com a fonte externa";
  return { status: status !== null && Number.isInteger(status) && status > 0 ? status : null, code, message: message.slice(0, 240) };
}
