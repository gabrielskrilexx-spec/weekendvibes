import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { registerSocialRoutes } from "../social-routes";

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
  }
  registerSocialRoutes(app, path.resolve(distPath, "index.html"));
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
