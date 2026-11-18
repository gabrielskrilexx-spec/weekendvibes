import { createHash } from "node:crypto";
import { fetchExternal } from "./external-fetch";
import { storagePut } from "./storage";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 8_000;
const persistentImageCache = new Map<string, Promise<string | null>>();

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function isDurableImageUrl(value: string) {
  return value.startsWith("/manus-storage/") || value.startsWith("data:image/");
}

function normalizeRemoteImageUrl(value: unknown) {
  const url = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(url) || isDurableImageUrl(url)) return "";
  return url.slice(0, 2000);
}

function getContentType(response: Response) {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return MIME_EXTENSIONS[contentType] ? contentType : null;
}

/**
 * Baixa uma imagem externa e grava uma cópia durável no storage do projeto.
 * Retorna null em falhas para que o pipeline preserve o input e permita o
 * fallback visual da venue, sem transformar uma capa indisponível em falha global.
 */
export async function persistRemoteImage(value: unknown, namespace = "event-covers"): Promise<string | null> {
  const original = normalizeRemoteImageUrl(value);
  if (!original) return isDurableImageUrl(String(value ?? "").trim()) ? String(value).trim() : null;

  const cached = persistentImageCache.get(original);
  if (cached) return cached;

  const task = (async () => {
    try {
      const response = await fetchExternal(
        original,
        { headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8", "User-Agent": "WeekendVibes/1.0 (+public-event-ingestion)" } },
        IMAGE_TIMEOUT_MS,
        false,
      );
      const contentType = getContentType(response);
      if (!contentType) throw new Error("upstream did not return a supported image content-type");
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_IMAGE_BYTES) throw new Error("upstream image exceeds 8 MB limit");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error("upstream image body is empty");
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error("downloaded image exceeds 8 MB limit");
      const digest = createHash("sha256").update(original).digest("hex");
      const stored = await storagePut(`${namespace}/${digest}.${MIME_EXTENSIONS[contentType]}`, bytes, contentType);
      return stored.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown image persistence error";
      console.warn("[Media] Remote cover was not persisted", { host: (() => { try { return new URL(original).hostname; } catch { return "invalid"; } })(), message: message.slice(0, 180) });
      return null;
    }
  })();

  persistentImageCache.set(original, task);
  return task;
}

export function clearPersistentImageCacheForTests() {
  persistentImageCache.clear();
}

export const MEDIA_PERSISTENCE_LIMITS = {
  maxBytes: MAX_IMAGE_BYTES,
  timeoutMs: IMAGE_TIMEOUT_MS,
} as const;
