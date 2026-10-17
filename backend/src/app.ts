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

  // Versioned API Prefix /api/v1
  app.use("/api/v1/health", healthRouter);
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
