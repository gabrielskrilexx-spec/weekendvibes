import { COOKIE_NAME } from "@shared/const";

export type AdminRestAck = {
  success: boolean;
  message?: string;
  [key: string]: unknown;
};

export class AdminRestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "AdminRestError";
  }
}

function getPreviewAuthHeaders(): Record<string, string> {
  try {
    if (typeof sessionStorage === "undefined") return {};
    const raw = sessionStorage.getItem("manus-cookie");
    if (!raw) return {};
    const prefix = `${COOKIE_NAME}=`;
    const pair = raw.split(";").find(value => value.trim().startsWith(prefix));
    const token = pair?.trim().slice(prefix.length);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function postAdminJson<T extends AdminRestAck>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...getPreviewAuthHeaders() },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    throw new AdminRestError("network_error", 0, "NETWORK_ERROR");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AdminRestError("invalid_response", response.status, "INVALID_RESPONSE");
  }

  if (!payload || typeof payload !== "object") {
    throw new AdminRestError("invalid_response", response.status, "INVALID_RESPONSE");
  }
  const result = payload as T;
  if (!response.ok || result.success !== true) {
    const payloadMessage = typeof result.message === "string" && result.message.length > 0 ? result.message : "A operação administrativa não foi concluída.";
    const code = typeof result.code === "string" ? result.code : response.status === 401 ? "UNAUTHORIZED" : response.status === 403 ? "FORBIDDEN" : response.status >= 500 ? "SERVER_ERROR" : "ADMIN_OPERATION_FAILED";
    throw new AdminRestError(payloadMessage, response.status, code);
  }
  return result;
}
