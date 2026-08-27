import { COOKIE_NAME } from "@shared/const";

export type AdminRestAck = {
  success: boolean;
  message?: string;
  [key: string]: unknown;
};

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
    throw new Error("Não foi possível comunicar com o servidor. Verifique a conexão e tente novamente.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("O servidor retornou uma resposta inválida. Tente novamente.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("O servidor retornou uma resposta inválida. Tente novamente.");
  }
  const result = payload as T;
  if (!response.ok || result.success !== true) {
    throw new Error(typeof result.message === "string" && result.message.length > 0 ? result.message : "A operação administrativa não foi concluída.");
  }
  return result;
}
