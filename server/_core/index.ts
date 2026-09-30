import { createServer } from "http";
import { createApp } from "./app.js";

export { createApp } from "./app.js";

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite.js");
    await setupVite(app, server);
  } else {
    const { serveStatic } = await import("./vite.js");
    serveStatic(app);
  }

  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT ?? "undefined"}`);
  }

  server.listen(port, host, () => {
    console.log(`[boot] WeekendVibes listening on ${host}:${port}`, {
      nodeEnv: process.env.NODE_ENV ?? "undefined",
    });
  });
}

if (process.env.VERCEL !== "1") {
  startServer().catch(console.error);
}
