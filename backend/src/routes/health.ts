import { Router, Request, Response } from "express";
import { config } from "../config/env.js";
import { db } from "../database/connection.js";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  let dbStatus = "connected";
  try {
    db.prepare("SELECT 1").get();
  } catch {
    dbStatus = "disconnected";
  }

  const bedrockConfigured = Boolean(
    !config.allowMockAi && config.awsRegion && config.bedrockModelId && (config.awsBearerTokenBedrock || process.env.AWS_ACCESS_KEY_ID)
  );

  const beeConfigured = Boolean(
    config.beeEnabled && config.beeApiBaseUrl && config.beeApiToken
  );

  res.json({
    status: dbStatus === "connected" ? "ok" : "degraded",
    database: dbStatus,
    bedrockConfigured,
    beeConfigured,
    modelId: config.bedrockModelId,
    region: config.awsRegion,
    mockMode: config.allowMockAi,
  });
});
