import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";

const MAPS_LIBRARIES = "marker,places,geocoding,geometry,routes";

export function registerMapsJavascriptRoute(app: Express): void {
  app.get("/api/maps/javascript", async (req: Request, res: Response) => {
    const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
    if (!baseUrl || !ENV.forgeApiKey) {
      res.status(503).type("text").send("/* maps_unavailable */");
      return;
    }

    const host = req.get("host");
    if (!host) {
      res.status(400).type("text").send("/* invalid_origin */");
      return;
    }

    const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto === "https" || req.secure ? "https" : "http";
    const origin = `${protocol}://${host}`;
    const callback = typeof req.query.callback === "string" ? req.query.callback : "";
    if (callback && !/^[_$A-Za-z][_$0-9A-Za-z]*$/.test(callback)) {
      res.status(400).type("text").send("/* invalid_callback */");
      return;
    }
    const url = new URL(`${baseUrl}/v1/maps/proxy/maps/api/js`);
    url.searchParams.set("key", ENV.forgeApiKey);
    url.searchParams.set("origin", origin);
    url.searchParams.set("v", "weekly");
    url.searchParams.set("libraries", MAPS_LIBRARIES);
    if (callback) url.searchParams.set("callback", callback);

    try {
      const upstream = await fetch(url, {
        headers: {
          Accept: "application/javascript,text/javascript,*/*;q=0.1",
          Origin: origin,
        },
      });
      if (!upstream.ok) {
        res.status(502).type("text").send("/* maps_upstream_unavailable */");
        return;
      }

      const body = await upstream.text();
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
      res.type("application/javascript").send(body);
    } catch {
      res.status(502).type("text").send("/* maps_upstream_unavailable */");
    }
  });
}

export { MAPS_LIBRARIES };
