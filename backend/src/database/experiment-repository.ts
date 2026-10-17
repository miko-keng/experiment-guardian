import { Database as DatabaseType } from "better-sqlite3";
import { db as defaultDb } from "./connection.js";
import {
  Experiment,
  ExperimentSource,
  ExperimentStatus,
  UUID,
} from "../extraction/experiment-schema.js";

export class SqliteExperimentRepository {
  constructor(private db: DatabaseType = defaultDb) {}

  create(experiment: Experiment, source: ExperimentSource): Experiment {
    const insertExp = this.db.prepare(`
      INSERT INTO experiments (
        id, title, hypothesis, objective, status,
        model_config_json, dataset_config_json,
        training_config_json, evaluation_config_json,
        baseline_experiment_id, extracted_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSource = this.db.prepare(`
      INSERT INTO experiment_sources (
        id, experiment_id, source_type, source_id,
        source_reference, transcript_text, transcript_hash,
        source_timestamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sourceId = source.sourceId || crypto.randomUUID();

    const txn = this.db.transaction(() => {
      insertExp.run(
        experiment.id,
        experiment.title,
        experiment.hypothesis,
        experiment.objective,
        experiment.status,
        JSON.stringify(experiment.model),
        JSON.stringify(experiment.dataset),
        JSON.stringify(experiment.training),
        JSON.stringify(experiment.evaluation),
        experiment.baselineExperimentId,
        experiment.extractedAt,
        experiment.createdAt,
        experiment.updatedAt
      );

      insertSource.run(
        sourceId,
        experiment.id,
        source.sourceType,
        source.sourceId,
        source.sourceReference,
        source.transcriptText || null,
        source.transcriptHash,
        source.sourceTimestamp,
        experiment.createdAt
      );
    });

    txn();
    return experiment;
  }

  findById(id: UUID): Experiment | null {
    const row = this.db
      .prepare(`
        SELECT e.*, s.source_type, s.source_id, s.source_reference,
               s.transcript_text, s.transcript_hash, s.source_timestamp
        FROM experiments e
        LEFT JOIN experiment_sources s ON e.id = s.experiment_id
        WHERE e.id = ?
      `)
      .get(id) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToExperiment(row);
  }

  findBySourceId(sourceId: string): Experiment | null {
    const row = this.db.prepare(`
      SELECT e.*, s.source_type, s.source_id, s.source_reference,
             s.transcript_text, s.transcript_hash, s.source_timestamp
      FROM experiments e
      INNER JOIN experiment_sources s ON e.id = s.experiment_id
      WHERE s.source_type = 'bee' AND s.source_id = ?
      ORDER BY e.created_at DESC
      LIMIT 1
    `).get(sourceId) as any;
    return row ? this.mapRowToExperiment(row) : null;
  }

  list(options: {
    limit: number;
    offset: number;
    status?: ExperimentStatus;
    search?: string;
  }): { items: Experiment[]; total: number } {
    let whereConditions: string[] = [];
    let params: any[] = [];

    if (options.status) {
      whereConditions.push("e.status = ?");
      params.push(options.status);
    }

    if (options.search && options.search.trim()) {
      whereConditions.push("(e.title LIKE ? OR e.hypothesis LIKE ? OR e.objective LIKE ?)");
      const term = `%${options.search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as count FROM experiments e ${whereClause}`)
      .get(...params) as any;
    const total = countRow ? countRow.count : 0;

    const rows = this.db
      .prepare(`
        SELECT e.*, s.source_type, s.source_id, s.source_reference,
               s.transcript_hash, s.source_timestamp
        FROM experiments e
        LEFT JOIN experiment_sources s ON e.id = s.experiment_id
        ${whereClause}
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...params, options.limit, options.offset) as any[];

    const items = rows.map((r) => this.mapRowToExperiment(r));
    return { items, total };
  }

  update(id: UUID, updates: Partial<Experiment>): Experiment | null {
    const current = this.findById(id);
    if (!current) {
      return null;
    }

    const updated: Experiment = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(`
        UPDATE experiments
        SET title = ?, hypothesis = ?, objective = ?, status = ?,
            model_config_json = ?, dataset_config_json = ?,
            training_config_json = ?, evaluation_config_json = ?,
            baseline_experiment_id = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        updated.title,
        updated.hypothesis,
        updated.objective,
        updated.status,
        JSON.stringify(updated.model),
        JSON.stringify(updated.dataset),
        JSON.stringify(updated.training),
        JSON.stringify(updated.evaluation),
        updated.baselineExperimentId,
        updated.updatedAt,
        id
      );

    return updated;
  }

  delete(id: UUID): boolean {
    const result = this.db.prepare("DELETE FROM experiments WHERE id = ?").run(id);
    return result.changes > 0;
  }

  private mapRowToExperiment(row: any): Experiment {
    let model = {};
    let dataset = {};
    let training = {};
    let evaluation = {};

    try {
      model = JSON.parse(row.model_config_json);
    } catch (e) {
      console.error("Failed to parse model_config_json for experiment", row.id);
    }

    try {
      dataset = JSON.parse(row.dataset_config_json);
    } catch (e) {
      console.error("Failed to parse dataset_config_json for experiment", row.id);
    }

    try {
      training = JSON.parse(row.training_config_json);
    } catch (e) {
      console.error("Failed to parse training_config_json for experiment", row.id);
    }

    try {
      evaluation = JSON.parse(row.evaluation_config_json);
    } catch (e) {
      console.error("Failed to parse evaluation_config_json for experiment", row.id);
    }

    return {
      id: row.id,
      title: row.title,
      hypothesis: row.hypothesis,
      objective: row.objective,
      status: row.status,
      model: model as any,
      dataset: dataset as any,
      training: training as any,
      evaluation: evaluation as any,
      baselineExperimentId: row.baseline_experiment_id,
      source: {
        sourceType: row.source_type || "manual",
        sourceId: row.source_id,
        sourceReference: row.source_reference,
        transcriptText: row.transcript_text,
        transcriptHash: row.transcript_hash,
        sourceTimestamp: row.source_timestamp,
      },
      extractedAt: row.extracted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const experimentRepository = new SqliteExperimentRepository();
