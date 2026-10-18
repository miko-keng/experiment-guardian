import { Database as DatabaseType } from "better-sqlite3";
import { db as defaultDb } from "./connection.js";
import { AuditFinding, FindingStatus } from "../audit/audit-types.js";
import { UUID } from "../extraction/experiment-schema.js";
import crypto from "crypto";
import type { AuditResult } from "../audit/audit-types.js";
import type { AuditRunRecord } from "../revisions/revision-types.js";

export interface AuditFindingComment {
  id: string;
  findingId: string;
  experimentId: string;
  sessionId: string;
  comment: string;
  analysis: Record<string, unknown>;
  createdAt: string;
}

export class SqliteAuditRepository {
  constructor(private db: DatabaseType = defaultDb) {}

  createRun(result: AuditResult, revisionId: UUID | null = null): AuditRunRecord {
    const run: AuditRunRecord = {
      id: crypto.randomUUID(),
      experimentId: result.experimentId,
      revisionId,
      auditVersion: result.auditVersion,
      summary: result.summary,
      completedAt: result.completedAt,
    };
    this.db.prepare(`
      INSERT INTO audit_runs (
        id, experiment_id, revision_id, audit_version, summary_json, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.experimentId,
      run.revisionId,
      run.auditVersion,
      JSON.stringify(run.summary),
      run.completedAt
    );
    return run;
  }

  createMany(findings: AuditFinding[], auditRunId: UUID | null = null): void {
    if (findings.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO audit_findings (
        id, experiment_id, rule_id, title, description,
        severity, status, evidence_json, recommendation,
        resolution_note, audit_version, created_at, updated_at, audit_run_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: AuditFinding[]) => {
      for (const f of items) {
        stmt.run(
          f.id,
          f.experimentId,
          f.ruleId,
          f.title,
          f.description,
          f.severity,
          f.status,
          JSON.stringify(f.evidence),
          f.recommendation,
          f.resolutionNote || null,
          "1.0.0",
          f.createdAt,
          f.updatedAt,
          auditRunId
        );
      }
    });

    insertMany(findings);
  }

  listByExperiment(experimentId: UUID): AuditFinding[] {
    const latestRun = this.db.prepare(`
      SELECT id FROM audit_runs
      WHERE experiment_id = ?
      ORDER BY completed_at DESC, rowid DESC
      LIMIT 1
    `).get(experimentId) as { id: string } | undefined;

    const rows = this.db
      .prepare(`
        SELECT * FROM audit_findings
        WHERE experiment_id = ?
          AND ${latestRun ? "audit_run_id = ?" : "audit_run_id IS NULL"}
        ORDER BY
          CASE severity
            WHEN 'critical' THEN 1
            WHEN 'warning' THEN 2
            WHEN 'info' THEN 3
            ELSE 4
          END,
          created_at DESC
      `)
      .all(...(latestRun ? [experimentId, latestRun.id] : [experimentId])) as any[];

    return rows.map((r) => this.mapRowToFinding(r));
  }

  listHistoryByExperiment(experimentId: UUID): AuditFinding[] {
    const rows = this.db.prepare(`
      SELECT findings.*
      FROM audit_findings AS findings
      LEFT JOIN audit_runs AS runs ON runs.id = findings.audit_run_id
      WHERE findings.experiment_id = ?
      ORDER BY COALESCE(runs.completed_at, findings.created_at) DESC,
        CASE findings.severity
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          WHEN 'info' THEN 3
          ELSE 4
        END,
        findings.created_at DESC
    `).all(experimentId) as any[];
    return rows.map((row) => this.mapRowToFinding(row));
  }

  listRunsByExperiment(experimentId: UUID): AuditRunRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_runs
      WHERE experiment_id = ?
      ORDER BY completed_at DESC, rowid DESC
    `).all(experimentId) as any[];
    return rows.map((row) => ({
      id: row.id,
      experimentId: row.experiment_id,
      revisionId: row.revision_id,
      auditVersion: row.audit_version,
      summary: JSON.parse(row.summary_json),
      completedAt: row.completed_at,
    }));
  }

  findById(id: UUID): AuditFinding | null {
    const row = this.db
      .prepare("SELECT * FROM audit_findings WHERE id = ?")
      .get(id) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToFinding(row);
  }

  updateStatus(
    id: UUID,
    status: FindingStatus,
    resolutionNote: string | null
  ): AuditFinding | null {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        UPDATE audit_findings
        SET status = ?, resolution_note = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(status, resolutionNote, now, id);

    if (result.changes === 0) {
      return null;
    }

    return this.findById(id);
  }

  createComment(input: Omit<AuditFindingComment, "id" | "createdAt">): AuditFindingComment {
    const item: AuditFindingComment = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.db.prepare(`
      INSERT INTO audit_finding_comments (
        id, finding_id, experiment_id, session_id, comment_text, analysis_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.findingId, item.experimentId, item.sessionId, item.comment, JSON.stringify(item.analysis), item.createdAt);
    return item;
  }

  listCommentsByExperiment(experimentId: UUID): AuditFindingComment[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_finding_comments
      WHERE experiment_id = ?
      ORDER BY created_at DESC
    `).all(experimentId) as any[];
    return rows.map((row) => ({
      id: row.id,
      findingId: row.finding_id,
      experimentId: row.experiment_id,
      sessionId: row.session_id,
      comment: row.comment_text,
      analysis: JSON.parse(row.analysis_json || "{}"),
      createdAt: row.created_at,
    }));
  }

  private mapRowToFinding(row: any): AuditFinding {
    let evidence = [];
    try {
      evidence = JSON.parse(row.evidence_json);
    } catch {
      evidence = [];
    }

    return {
      id: row.id,
      experimentId: row.experiment_id,
      ruleId: row.rule_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      evidence,
      recommendation: row.recommendation,
      resolutionNote: row.resolution_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      auditRunId: row.audit_run_id || null,
    };
  }
}

export const auditRepository = new SqliteAuditRepository();
