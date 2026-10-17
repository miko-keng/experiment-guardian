import { Router, Request, Response, NextFunction } from "express";
import { auditService } from "../services/audit-service.js";
import type { FindingStatus } from "../audit/audit-types.js";
import { z } from "zod";
import { findingInvestigationService } from "../services/finding-investigation-service.js";

export const auditsRouter = Router();

auditsRouter.post("/:findingId/comments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const findingId = Array.isArray(req.params.findingId) ? req.params.findingId[0] : req.params.findingId;
    const input = z.object({ comment: z.string().trim().min(3).max(4000) }).parse(req.body);
    const saved = await findingInvestigationService.investigate(findingId, input.comment);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/audits/:findingId
auditsRouter.patch("/:findingId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, resolutionNote } = req.body;
    const validStatuses: FindingStatus[] = ["open", "resolved", "accepted", "dismissed"];

    if (!validStatuses.includes(status)) {
      res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message: `Status must be one of: ${validStatuses.join(", ")}`,
        },
      });
      return;
    }

    const findingId = Array.isArray(req.params.findingId) ? req.params.findingId[0] : req.params.findingId;
    const updated = auditService.updateFindingStatus(
      findingId,
      status,
      resolutionNote || null
    );

    if (!updated) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Finding with id '${req.params.findingId}' was not found`,
        },
      });
      return;
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
