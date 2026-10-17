import crypto from "crypto";
import type { Database as DatabaseType } from "better-sqlite3";
import { db as defaultDb } from "./connection.js";
import type { AuditEvidence } from "../audit/audit-types.js";
import type { UUID } from "../extraction/experiment-schema.js";
import type { DecisionState, ResearchDecision } from "../decisions/decision-types.js";

export class SqliteDecisionRepository {
  constructor(private db: DatabaseType = defaultDb) {}

  create(input: {
    experimentId: UUID;
    state: DecisionState;
    statement: string;
    owner: string | null;
    sourceConversationId: string | null;
    evidence: AuditEvidence[];
  }): ResearchDecision {
    const now = new Date().toISOString();
    const decision: ResearchDecision = {
      id: crypto.randomUUID(),
      experimentId: input.experimentId,
      state: input.state,
      statement: input.statement,
      owner: input.owner,
      sourceConversationId: input.sourceConversationId,
      evidence: input.evidence,
      createdAt: now,
      updatedAt: now,
    };
    this.db.prepare(`
      INSERT INTO research_decisions (
        id, experiment_id, state, statement, owner,
        source_conversation_id, evidence_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decision.id,
      decision.experimentId,
      decision.state,
      decision.statement,
      decision.owner,
      decision.sourceConversationId,
      JSON.stringify(decision.evidence),
      decision.createdAt,
      decision.updatedAt
    );
    return decision;
  }

  listByExperiment(experimentId: UUID): ResearchDecision[] {
    const rows = this.db.prepare(`
      SELECT * FROM research_decisions
      WHERE experiment_id = ?
      ORDER BY created_at DESC
    `).all(experimentId) as any[];
    return rows.map((row) => this.mapRow(row));
  }

  updateState(id: UUID, experimentId: UUID, state: DecisionState): ResearchDecision | null {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE research_decisions
      SET state = ?, updated_at = ?
      WHERE id = ? AND experiment_id = ?
    `).run(state, now, id, experimentId);
    if (result.changes === 0) return null;
    const row = this.db.prepare("SELECT * FROM research_decisions WHERE id = ?").get(id) as any;
    return this.mapRow(row);
  }

  private mapRow(row: any): ResearchDecision {
    return {
      id: row.id,
      experimentId: row.experiment_id,
      state: row.state,
      statement: row.statement,
      owner: row.owner,
      sourceConversationId: row.source_conversation_id,
      evidence: JSON.parse(row.evidence_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const decisionRepository = new SqliteDecisionRepository();
