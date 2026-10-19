import crypto from "crypto";
import { db } from "./connection.js";

export interface LinkedEvidenceSnapshot {
  id: string;
  experimentId: string;
  gitlabMrUrl: string;
  gitlabProjectPath: string;
  gitlabMrIid: number;
  gitlabCommitSha: string;
  mlflowRunId: string;
  mlflowTrackingUrl: string;
  evidence: Record<string, any>;
  fetchedAt: string;
}

function fromRow(row: any): LinkedEvidenceSnapshot {
  return {
    id: row.id, experimentId: row.experiment_id, gitlabMrUrl: row.gitlab_mr_url,
    gitlabProjectPath: row.gitlab_project_path, gitlabMrIid: row.gitlab_mr_iid,
    gitlabCommitSha: row.gitlab_commit_sha, mlflowRunId: row.mlflow_run_id,
    mlflowTrackingUrl: row.mlflow_tracking_url, evidence: JSON.parse(row.evidence_json),
    fetchedAt: row.fetched_at,
  };
}

class LinkedEvidenceRepository {
  create(input: Omit<LinkedEvidenceSnapshot, "id" | "fetchedAt">): LinkedEvidenceSnapshot {
    const snapshot = { ...input, id: crypto.randomUUID(), fetchedAt: new Date().toISOString() };
    db.prepare(`INSERT INTO linked_evidence_snapshots
      (id, experiment_id, gitlab_mr_url, gitlab_project_path, gitlab_mr_iid,
       gitlab_commit_sha, mlflow_run_id, mlflow_tracking_url, evidence_json, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      snapshot.id, snapshot.experimentId, snapshot.gitlabMrUrl, snapshot.gitlabProjectPath,
      snapshot.gitlabMrIid, snapshot.gitlabCommitSha, snapshot.mlflowRunId,
      snapshot.mlflowTrackingUrl, JSON.stringify(snapshot.evidence), snapshot.fetchedAt,
    );
    return snapshot;
  }

  list(experimentId: string): LinkedEvidenceSnapshot[] {
    return (db.prepare(`SELECT * FROM linked_evidence_snapshots WHERE experiment_id = ?
      ORDER BY fetched_at DESC, rowid DESC`).all(experimentId) as any[]).map(fromRow);
  }

  latest(experimentId: string): LinkedEvidenceSnapshot | null {
    const row = db.prepare(`SELECT * FROM linked_evidence_snapshots WHERE experiment_id = ?
      ORDER BY fetched_at DESC, rowid DESC LIMIT 1`).get(experimentId);
    return row ? fromRow(row) : null;
  }

  latestForMergeRequest(mergeRequestUrl: string): LinkedEvidenceSnapshot | null {
    const row = db.prepare(`SELECT * FROM linked_evidence_snapshots WHERE gitlab_mr_url = ?
      ORDER BY fetched_at DESC, rowid DESC LIMIT 1`).get(mergeRequestUrl);
    return row ? fromRow(row) : null;
  }
}

export const linkedEvidenceRepository = new LinkedEvidenceRepository();
