import { Router, Request, Response, NextFunction } from "express";
import { auditService } from "../services/audit-service.js";
import type { FindingStatus } from "../audit/audit-types.js";
import { z } from "zod";
import { auditRepository } from "../database/audit-repository.js";
import { alexaSessionService } from "../services/alexa-session-service.js";
import { BedrockIntegrationError } from "../integrations/bedrock/bedrock-errors.js";

export const auditsRouter = Router();

auditsRouter.post("/:findingId/comments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const findingId = Array.isArray(req.params.findingId) ? req.params.findingId[0] : req.params.findingId;
    const input = z.object({ comment: z.string().trim().min(3).max(4000) }).parse(req.body);
    const finding = auditRepository.findById(findingId);
    if (!finding) throw new BedrockIntegrationError("NOT_FOUND", "Audit finding not found", undefined, 404);

    const started = alexaSessionService.start({
      title: `Investigation: ${finding.title}`,
      experimentId: finding.experimentId,
    });
    const investigation = await alexaSessionService.addObservation({
      sessionId: started.data.id,
      text: `Researcher comment on audit finding "${finding.title}": ${input.comment}`,
    });
    const suggestion = investigation.nextAction === "request_confirmation"
      ? investigation.speech.text
      : `${finding.recommendation} ${investigation.speech.text}`;
    const saved = auditRepository.createComment({
      findingId: finding.id,
      experimentId: finding.experimentId,
      sessionId: started.data.id,
      comment: input.comment,
      analysis: {
        suggestion,
        speech: investigation.speech.text,
        nextAction: investigation.nextAction,
        visual: investigation.visual,
        data: investigation.data,
      },
    });
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
