import crypto from "crypto";
import type { Database as DatabaseType } from "better-sqlite3";
import { db as defaultDb } from "./connection.js";
import type {
  EditableExperimentFieldPath,
  ExperimentRevision,
  RevisionAuthor,
  RevisionStatus,
} from "../revisions/revision-types.js";
import type { AuditEvidence } from "../audit/audit-types.js";
import type { UUID } from "../extraction/experiment-schema.js";

export class SqliteRevisionRepository {
  constructor(private db: DatabaseType = defaultDb) {}

  create(input: {
    experimentId: UUID;
    fieldPath: EditableExperimentFieldPath;
    previousValue: unknown;
    proposedValue: unknown;
    reason: string;
    evidence: AuditEvidence[];
    proposedBy: RevisionAuthor;
  }): ExperimentRevision {
    const revision: ExperimentRevision = {
      id: crypto.randomUUID(),
      experimentId: input.experimentId,
      fieldPath: input.fieldPath,
      previousValue: input.previousValue,
      proposedValue: input.proposedValue,
      status: "proposed",
      reason: input.reason,
      evidence: input.evidence,
      proposedBy: input.proposedBy,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO experiment_revisions (
        id, experiment_id, field_path, previous_value_json,
        proposed_value_json, status, reason, evidence_json,
        proposed_by, reviewed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      revision.id,
      revision.experimentId,
      revision.fieldPath,
      JSON.stringify(revision.previousValue),
      JSON.stringify(revision.proposedValue),
      revision.status,
      revision.reason,
      JSON.stringify(revision.evidence),
      revision.proposedBy,
      revision.reviewedAt,
      revision.createdAt
    );

    return revision;
  }

  findById(id: UUID): ExperimentRevision | null {
    const row = this.db.prepare("SELECT * FROM experiment_revisions WHERE id = ?").get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  listByExperiment(experimentId: UUID): ExperimentRevision[] {
    const rows = this.db.prepare(`
      SELECT * FROM experiment_revisions
      WHERE experiment_id = ?
      ORDER BY created_at DESC
    `).all(experimentId) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  updateStatus(id: UUID, status: Exclude<RevisionStatus, "proposed">): ExperimentRevision | null {
    const reviewedAt = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE experiment_revisions
      SET status = ?, reviewed_at = ?
      WHERE id = ? AND status = 'proposed'
    `).run(status, reviewedAt, id);
    return result.changes > 0 ? this.findById(id) : null;
  }

  private mapRow(row: any): ExperimentRevision {
    return {
      id: row.id,
      experimentId: row.experiment_id,
      fieldPath: row.field_path,
      previousValue: JSON.parse(row.previous_value_json),
      proposedValue: JSON.parse(row.proposed_value_json),
      status: row.status,
      reason: row.reason,
      evidence: JSON.parse(row.evidence_json),
      proposedBy: row.proposed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
    };
  }
}

export const revisionRepository = new SqliteRevisionRepository();
