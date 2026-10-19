import express, { Express } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { experimentsRouter } from "./routes/experiments.js";
import { auditsRouter } from "./routes/audits.js";
import { beeRouter } from "./routes/bee.js";
import { errorHandler } from "./middleware/error-handler.js";
import { alexaRouter } from "./routes/alexa.js";
import { sourcesRouter } from "./routes/sources.js";
import { capabilitiesRouter } from "./routes/capabilities.js";
import { reportsRouter } from "./routes/reports.js";
import { handleMcpRequest } from "./mcp/server.js";
import crypto from "crypto";

export function createApp(): Express {
  const app = express();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");

  // Configure CORS
  app.use(
    cors({
      origin: [
        config.frontendOrigin,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
      ],
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Body parsing
  app.use(express.json({ limit: "2mb" }));

  // Render probes this endpoint without credentials. Keep only health public.
  app.use("/api/v1/health", healthRouter);

  // Protect the other routes and hosted UI when private source tokens are used.
  if (config.appAccessPassword) {
    app.use((req, res, next) => {
      const authorization = req.headers.authorization || "";
      let supplied = "";
      if (authorization.startsWith("Basic ")) {
        try {
          const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
          const separator = decoded.indexOf(":");
          if (separator >= 0 && decoded.slice(0, separator) === "researcher") supplied = decoded.slice(separator + 1);
        } catch { /* Invalid Basic credentials. */ }
      }
      const expected = Buffer.from(config.appAccessPassword!);
      const actual = Buffer.from(supplied);
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        res.setHeader("WWW-Authenticate", 'Basic realm="Experiment Guardian"');
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Sign in to Experiment Guardian" } });
        return;
      }
      next();
    });
  }

  // Versioned API Prefix /api/v1
  app.use("/api/v1/experiments", experimentsRouter);
  app.use("/api/v1/audits", auditsRouter);
  app.use("/api/v1/bee", beeRouter);
  app.use("/api/v1/alexa", alexaRouter);
  app.use("/api/v1/sources", sourcesRouter);
  app.use("/api/v1/capabilities", capabilitiesRouter);
  app.use("/api/v1/reports", reportsRouter);

  app.all("/mcp", (req, res, next) => {
    handleMcpRequest(req, res).catch(next);
  });

  // In production the Express service also hosts the compiled React app. This
  // gives the browser UI, REST API, and MCP endpoint one public HTTPS origin.
  if (config.nodeEnv === "production" && fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path === "/mcp") {
        next();
        return;
      }
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  // Standard Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
