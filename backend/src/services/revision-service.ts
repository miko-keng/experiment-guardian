import type { Database as DatabaseType } from "better-sqlite3";
import { db as defaultDb } from "../database/connection.js";
import { experimentRepository } from "../database/experiment-repository.js";
import { revisionRepository } from "../database/revision-repository.js";
import { auditService } from "./audit-service.js";
import { BedrockIntegrationError } from "../integrations/bedrock/bedrock-errors.js";
import type { Experiment, UUID } from "../extraction/experiment-schema.js";
import type {
  EditableExperimentFieldPath,
  ExperimentRevision,
  RevisionAuthor,
} from "../revisions/revision-types.js";
import type { AuditEvidence } from "../audit/audit-types.js";

const numericFields = new Set<EditableExperimentFieldPath>([
  "training.learningRate",
  "training.batchSize",
  "training.epochs",
  "training.randomSeed",
]);

function getFieldValue(experiment: Experiment, path: EditableExperimentFieldPath): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, experiment);
}

function normalizedValue(path: EditableExperimentFieldPath, value: unknown): unknown {
  if (value === "" || value === null) return null;
  if (numericFields.has(path)) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) {
      throw new BedrockIntegrationError(
        "INVALID_REVISION_VALUE",
        `${path} must be a finite number or null`,
        undefined,
        400
      );
    }
    return number;
  }
  if (typeof value !== "string") {
    throw new BedrockIntegrationError(
      "INVALID_REVISION_VALUE",
      `${path} must be text or null`,
      undefined,
      400
    );
  }
  return value.trim() || null;
}

function setFieldValue(
  experiment: Experiment,
  path: EditableExperimentFieldPath,
  value: unknown
): Experiment {
  const updated = structuredClone(experiment);
  const parts = path.split(".");
  let target: Record<string, unknown> = updated as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    target = target[part] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;
  return updated;
}

export class RevisionService {
  constructor(private database: DatabaseType = defaultDb) {}

  list(experimentId: UUID): ExperimentRevision[] {
    this.requireExperiment(experimentId);
    return revisionRepository.listByExperiment(experimentId);
  }

  propose(input: {
    experimentId: UUID;
    fieldPath: EditableExperimentFieldPath;
    proposedValue: unknown;
    reason: string;
    evidence: AuditEvidence[];
    proposedBy: RevisionAuthor;
  }): ExperimentRevision {
    const experiment = this.requireExperiment(input.experimentId);
    const proposedValue = normalizedValue(input.fieldPath, input.proposedValue);
    const previousValue = getFieldValue(experiment, input.fieldPath);
    if (Object.is(previousValue, proposedValue)) {
      throw new BedrockIntegrationError(
        "REVISION_UNCHANGED",
        "The proposed value matches the current experiment value",
        undefined,
        400
      );
    }
    return revisionRepository.create({ ...input, previousValue, proposedValue });
  }

  apply(experimentId: UUID, revisionId: UUID) {
    return this.database.transaction(() => {
      const experiment = this.requireExperiment(experimentId);
      const revision = this.requireProposedRevision(experimentId, revisionId);
      const currentValue = getFieldValue(experiment, revision.fieldPath);
      if (JSON.stringify(currentValue) !== JSON.stringify(revision.previousValue)) {
        throw new BedrockIntegrationError(
          "REVISION_CONFLICT",
          "The experiment changed after this revision was proposed. Refresh and create a new proposal.",
          undefined,
          409
        );
      }

      const changed = setFieldValue(experiment, revision.fieldPath, revision.proposedValue);
      const saved = experimentRepository.update(experimentId, changed);
      if (!saved) throw new Error("Experiment update failed");
      const applied = revisionRepository.updateStatus(revisionId, "applied");
      if (!applied) throw new Error("Revision update failed");
      const audit = auditService.runAuditForExperiment(saved, revisionId);
      return { revision: applied, experiment: saved, audit };
    })();
  }

  reject(experimentId: UUID, revisionId: UUID): ExperimentRevision {
    this.requireExperiment(experimentId);
    this.requireProposedRevision(experimentId, revisionId);
    const revision = revisionRepository.updateStatus(revisionId, "rejected");
    if (!revision) throw new Error("Revision update failed");
    return revision;
  }

  private requireExperiment(experimentId: UUID): Experiment {
    const experiment = experimentRepository.findById(experimentId);
    if (!experiment) {
      throw new BedrockIntegrationError("NOT_FOUND", "Experiment not found", undefined, 404);
    }
    return experiment;
  }

  private requireProposedRevision(experimentId: UUID, revisionId: UUID): ExperimentRevision {
    const revision = revisionRepository.findById(revisionId);
    if (!revision || revision.experimentId !== experimentId) {
      throw new BedrockIntegrationError("NOT_FOUND", "Revision not found", undefined, 404);
    }
    if (revision.status !== "proposed") {
      throw new BedrockIntegrationError(
        "REVISION_ALREADY_REVIEWED",
        `Revision has already been ${revision.status}`,
        undefined,
        409
      );
    }
    return revision;
  }
}

export const revisionService = new RevisionService();
