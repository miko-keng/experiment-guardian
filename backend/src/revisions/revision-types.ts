import { z } from "zod";
import type { AuditEvidence } from "../audit/audit-types.js";
import type { UUID } from "../extraction/experiment-schema.js";

export type RevisionStatus = "proposed" | "applied" | "rejected";
export type RevisionAuthor = "assistant" | "user";

export const editableExperimentFieldPaths = [
  "title",
  "hypothesis",
  "objective",
  "model.architecture",
  "model.modelName",
  "model.modelVersion",
  "dataset.datasetName",
  "dataset.datasetVersion",
  "dataset.datasetIdentifier",
  "dataset.trainSplit",
  "dataset.validationSplit",
  "dataset.testSplit",
  "training.learningRate",
  "training.batchSize",
  "training.epochs",
  "training.optimizer",
  "training.randomSeed",
  "training.framework",
  "training.frameworkVersion",
  "evaluation.evaluationProcedure",
  "evaluation.evaluationDatasetIdentifier",
  "evaluation.codeCommit",
  "evaluation.notes",
] as const;

export type EditableExperimentFieldPath = typeof editableExperimentFieldPaths[number];

export const ProposedRevisionInputSchema = z.object({
  fieldPath: z.enum(editableExperimentFieldPaths),
  proposedValue: z.unknown(),
  reason: z.string().trim().min(3).max(2000),
  evidence: z.array(z.unknown()).default([]),
  proposedBy: z.enum(["assistant", "user"]).default("user"),
}).refine((value) => value.proposedValue !== undefined, {
  message: "proposedValue is required",
  path: ["proposedValue"],
});

export interface ExperimentRevision {
  id: UUID;
  experimentId: UUID;
  fieldPath: EditableExperimentFieldPath;
  previousValue: unknown;
  proposedValue: unknown;
  status: RevisionStatus;
  reason: string;
  evidence: AuditEvidence[];
  proposedBy: RevisionAuthor;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AuditRunRecord {
  id: UUID;
  experimentId: UUID;
  revisionId: UUID | null;
  auditVersion: string;
  summary: { critical: number; warning: number; info: number; open: number };
  completedAt: string;
}
