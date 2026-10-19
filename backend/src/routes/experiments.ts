import { Router, Request, Response, NextFunction } from "express";
import { experimentService } from "../services/experiment-service.js";
import { auditService } from "../services/audit-service.js";
import type { ExperimentStatus } from "../extraction/experiment-schema.js";
import { ProposedRevisionInputSchema } from "../revisions/revision-types.js";
import { revisionService } from "../services/revision-service.js";
import { CreateDecisionSchema, UpdateDecisionSchema } from "../decisions/decision-types.js";
import { decisionRepository } from "../database/decision-repository.js";
import { auditRepository } from "../database/audit-repository.js";
import { artifactRepository } from "../database/artifact-repository.js";
import { db } from "../database/connection.js";
import { getVerification } from "../services/verification-service.js";
import { z } from "zod";
import crypto from "crypto";
import multer from "multer";
import { LinkEvidenceSchema, linkedEvidenceService } from "../services/linked-evidence-service.js";
import { linkedEvidenceRepository } from "../database/linked-evidence-repository.js";
import { BedrockIntegrationError } from "../integrations/bedrock/bedrock-errors.js";

export const experimentsRouter = Router();
const linkedFailure = (error: unknown) => error instanceof z.ZodError ? error :
  new BedrockIntegrationError("LINKED_EVIDENCE_FAILED",
    error instanceof Error ? error.message : "Could not read linked evidence", undefined, 502);
const artifactUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single("file");
const artifactKinds = ["run_manifest", "dataset_manifest", "training_config", "evaluation_script",
  "evaluation_result", "model_checkpoint", "dependency_lock"] as const;

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

// Start from an existing GitLab merge request and MLflow run, with no notes or LLM required.
experimentsRouter.post("/linked-review", async (req, res, next) => {
  try {
    const result = await linkedEvidenceService.import(null, LinkEvidenceSchema.parse(req.body));
    res.status(201).json(result);
  } catch (error) { next(linkedFailure(error)); }
});

experimentsRouter.get("/linked-review/lookup", (req, res) => {
  const mergeRequestUrl = String(req.query.mergeRequestUrl || "");
  const snapshot = linkedEvidenceRepository.latestForMergeRequest(mergeRequestUrl);
  if (!snapshot) { res.status(404).json({ error: { code: "NOT_FOUND", message: "No review is linked to this merge request" } }); return; }
  res.json({ experimentId: snapshot.experimentId, snapshotId: snapshot.id,
    qualityGate: getVerification(snapshot.experimentId)?.qualityGate });
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
    const verification = getVerification(id);
    const linkedEvidence = linkedEvidenceRepository.list(id);

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
      verification,
      linkedEvidence,
    });
  } catch (err) {
    next(err);
  }
});

experimentsRouter.post("/:id/linked-evidence", async (req, res, next) => {
  try {
    const result = await linkedEvidenceService.import(String(req.params.id), LinkEvidenceSchema.parse(req.body));
    res.status(201).json(result);
  } catch (error) { next(linkedFailure(error)); }
});

experimentsRouter.get("/:id/quality-gate", (req, res) => {
  const verification = getVerification(String(req.params.id));
  if (!verification) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Experiment not found" } }); return; }
  res.json(verification.qualityGate);
});

experimentsRouter.put("/:id/policy", (req, res, next) => {
  try {
    const id = String(req.params.id);
    const input = z.object({ policyId: z.literal("ml-research") }).parse(req.body);
    const experiment = experimentService.getExperiment(id);
    if (!experiment) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Experiment not found" } }); return; }
    const audit = db.transaction(() => {
      artifactRepository.setPolicy(id, input.policyId);
      return auditService.runAuditForExperiment(experiment);
    })();
    res.json({ audit, verification: getVerification(id) });
  } catch (error) { next(error); }
});

experimentsRouter.post("/:id/artifacts", (req, res, next) => {
  try {
    const id = String(req.params.id);
    const experiment = experimentService.getExperiment(id);
    if (!experiment) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Experiment not found" } }); return; }
    const input = z.object({
      kind: z.enum(artifactKinds),
      uri: z.string().trim().min(1).max(1000).nullable().optional(),
      metadata: z.record(z.unknown()).default({}),
    }).parse(req.body);
    const { artifact, audit } = db.transaction(() => {
      const artifact = artifactRepository.create({ experimentId: id, kind: input.kind,
        uri: input.uri ?? null, metadata: input.metadata,
        contentHash: crypto.createHash("sha256").update(JSON.stringify(input.metadata)).digest("hex"),
        source: "user_supplied" });
      return { artifact, audit: auditService.runAuditForExperiment(experiment) };
    })();
    res.status(201).json({ artifact, audit, verification: getVerification(id) });
  } catch (error) { next(error); }
});

experimentsRouter.post("/:id/artifact-files", artifactUpload, (req, res, next) => {
  try {
    const id = String(req.params.id);
    const experiment = experimentService.getExperiment(id);
    if (!experiment) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Experiment not found" } }); return; }
    if (!req.file) { res.status(400).json({ error: { code: "MISSING_FILE", message: "An artifact file is required" } }); return; }
    const kind = z.enum(artifactKinds).parse(req.body.kind);
    const structured = ["run_manifest", "dataset_manifest", "training_config", "evaluation_result"].includes(kind);
    let metadata: Record<string, unknown> = { path: req.file.originalname, bytes: req.file.size };
    if (structured) {
      if (!req.file.originalname.toLowerCase().endsWith(".json")) {
        res.status(400).json({ error: { code: "INVALID_ARTIFACT", message: "Run, dataset, training, and result artifacts must be JSON files" } }); return;
      }
      let parsed: unknown;
      try { parsed = JSON.parse(req.file.buffer.toString("utf8")); }
      catch { res.status(400).json({ error: { code: "INVALID_ARTIFACT", message: "Artifact file must contain valid JSON" } }); return; }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        res.status(400).json({ error: { code: "INVALID_ARTIFACT", message: "Artifact JSON must be an object" } }); return;
      }
      metadata = parsed as Record<string, unknown>;
    }
    const result = db.transaction(() => {
      const artifact = artifactRepository.createUploadedFile({ experimentId: id, kind,
        originalName: req.file!.originalname, mediaType: req.file!.mimetype || "application/octet-stream",
        content: req.file!.buffer, metadata });
      return { artifact, audit: auditService.runAuditForExperiment(experiment) };
    })();
    res.status(201).json({ ...result, verification: getVerification(id) });
  } catch (error) { next(error); }
});

experimentsRouter.get("/:id/artifacts/:artifactId/file", (req, res) => {
  const file = artifactRepository.findFile(String(req.params.id), String(req.params.artifactId));
  if (!file) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Artifact file not found" } }); return; }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  res.setHeader("Content-Type", file.mediaType);
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  res.send(file.content);
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
