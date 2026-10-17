import { Router, Request, Response, NextFunction } from "express";
import { beeService } from "../services/bee-service.js";

export const beeRouter = Router();

// GET /api/v1/bee/status
beeRouter.get("/status", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await beeService.getStatus();
    res.json({
      ...status,
      configured: status.enabled && status.installed && status.authenticated,
      status: status.authenticated ? "ready" : status.installed ? "authentication_required" : "not_configured",
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/bee/conversations
beeRouter.get("/conversations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const requestedLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : 20;
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 20;
    res.json(await beeService.listConversations(cursor, limit));
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/bee/conversations/:id
beeRouter.get("/conversations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json(await beeService.getConversation(id));
  } catch (error) {
    next(error);
  }
});

beeRouter.get("/conversations/:id/related", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const requestedLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 10;
    res.json({ items: await beeService.getRelated(id, limit) });
  } catch (error) {
    next(error);
  }
});

beeRouter.post("/conversations/:id/import", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.status(201).json(await beeService.importConversation(id));
  } catch (error) {
    next(error);
  }
});

beeRouter.post("/conversations/:id/sync", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json(await beeService.syncConversation(id));
  } catch (error) {
    next(error);
  }
});
