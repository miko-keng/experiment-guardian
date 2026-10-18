import { Router, Request, Response, NextFunction } from "express";
import { experimentService } from "../services/experiment-service.js";
import { auditService } from "../services/audit-service.js";
import type { ExperimentStatus } from "../extraction/experiment-schema.js";
import { ProposedRevisionInputSchema } from "../revisions/revision-types.js";
import { revisionService } from "../services/revision-service.js";
import { CreateDecisionSchema, UpdateDecisionSchema } from "../decisions/decision-types.js";
import { decisionRepository } from "../database/decision-repository.js";
import { auditRepository } from "../database/audit-repository.js";

export const experimentsRouter = Router();

// POST /api/v1/experiments/audit
experimentsRouter.post("/audit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transcript, sourceType, sourceId, sourceReference, baselineExperimentId, persistTranscript } = req.body;
    const result = await experimentService.createAndAudit({
      transcript,
      sourceType,
      sourceId,
      sourceReference,
      baselineExperimentId,
      persistTranscript,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/experiments
experimentsRouter.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 100);
    const offset = Math.max(parseInt((req.query.offset as string) || "0", 10), 0);
    const status = req.query.status as ExperimentStatus | undefined;
    const search = req.query.search as string | undefined;

    const data = experimentService.listExperiments({
      limit,
      offset,
      status,
      search,
    });

    res.json({
      items: data.items,
      total: data.total,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/experiments/:id
experimentsRouter.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const experiment = experimentService.getExperiment(id);
    if (!experiment) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Experiment with id '${id}' was not found`,
        },
      });
      return;
    }

    const findings = auditService.getFindingsForExperiment(id);
    const revisions = revisionService.list(id);
    const decisions = decisionRepository.listByExperiment(id);
    const auditHistory = auditService.getAuditHistory(id);
    const findingComments = auditRepository.listCommentsByExperiment(id);
    const findingHistory = auditService.getFindingHistory(id);

    let baseline = null;
    if (experiment.baselineExperimentId) {
      baseline = experimentService.getExperiment(experiment.baselineExperimentId);
    }

    res.json({
      experiment,
      findings,
      baseline,
      revisions,
      decisions,
      auditHistory,
      findingComments,
      findingHistory,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/experiments/:id/revisions
experimentsRouter.get("/:id/revisions", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ items: revisionService.list(id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/experiments/:id/revisions
experimentsRouter.post("/:id/revisions", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = ProposedRevisionInputSchema.parse(req.body);
    const revision = revisionService.propose({
      experimentId: id,
      fieldPath: input.fieldPath,
      proposedValue: input.proposedValue,
      reason: input.reason,
      evidence: input.evidence as any[],
      proposedBy: input.proposedBy,
    });
    res.status(201).json(revision);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/experiments/:id/revisions/:revisionId/apply
experimentsRouter.post("/:id/revisions/:revisionId/apply", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const revisionId = Array.isArray(req.params.revisionId) ? req.params.revisionId[0] : req.params.revisionId;
    res.json(revisionService.apply(id, revisionId));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/experiments/:id/revisions/:revisionId/reject
experimentsRouter.post("/:id/revisions/:revisionId/reject", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const revisionId = Array.isArray(req.params.revisionId) ? req.params.revisionId[0] : req.params.revisionId;
    res.json(revisionService.reject(id, revisionId));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/experiments/:id/decisions
experimentsRouter.post("/:id/decisions", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!experimentService.getExperiment(id)) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Experiment not found" } });
      return;
    }
    const input = CreateDecisionSchema.parse(req.body);
    const decision = decisionRepository.create({
      experimentId: id,
      state: input.state,
      statement: input.statement,
      owner: input.owner,
      sourceConversationId: input.sourceConversationId,
      evidence: input.evidence as any[],
    });
    res.status(201).json(decision);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/experiments/:id/decisions/:decisionId
experimentsRouter.patch("/:id/decisions/:decisionId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const decisionId = Array.isArray(req.params.decisionId) ? req.params.decisionId[0] : req.params.decisionId;
    const input = UpdateDecisionSchema.parse(req.body);
    const decision = decisionRepository.updateState(decisionId, id, input.state);
    if (!decision) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Decision not found" } });
      return;
    }
    res.json(decision);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/experiments/:id/audit
experimentsRouter.get("/:id/audit", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const experiment = experimentService.getExperiment(id);
    if (!experiment) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Experiment with id '${id}' was not found`,
        },
      });
      return;
    }

    const findings = auditService.getFindingsForExperiment(id);
    res.json({
      experimentId: id,
      findings,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/experiments/:id
experimentsRouter.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const success = experimentService.deleteExperiment(id);
    if (!success) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Experiment with id '${id}' was not found`,
        },
      });
      return;
    }

    res.json({ success: true, id });
  } catch (err) {
    next(err);
  }
});
