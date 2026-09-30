import type { Express } from "express";
import { ENV } from "./env.js";
import { redactError } from "./security.js";

export function isSafeStorageKey(key: string) {
  return Boolean(key) && key.length <= 512 && !key.includes("..") && !/[\u0000-\u001f\u007f]/.test(key);
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const rawKey = (req.params as Record<string, string>)[0];
    let key = "";
    try {
      key = decodeURIComponent(rawKey ?? "");
    } catch {
      res.status(400).send("Invalid storage key");
      return;
    }
    if (!isSafeStorageKey(key)) {
      res.status(400).send("Invalid storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(503).json({ error: "storage_unavailable" });
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        console.warn("[StorageProxy] upstream request failed");
        res.status(502).json({ error: "storage_backend_error" });
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).json({ error: "storage_backend_error" });
        return;
      }

      res.set({
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "Referrer-Policy": "no-referrer",
      });
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed", redactError(err));
      res.status(502).json({ error: "storage_backend_error" });
    }
  });
}
