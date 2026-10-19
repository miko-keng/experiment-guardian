import crypto from "crypto";
import { db } from "./connection.js";

export type ArtifactKind = "run_manifest" | "dataset_manifest" | "training_config" | "evaluation_script" | "evaluation_result" | "model_checkpoint" | "dependency_lock";
export interface ExperimentArtifact {
  id: string;
  experimentId: string;
  kind: ArtifactKind;
  uri: string | null;
  contentHash: string | null;
  metadata: Record<string, unknown>;
  source: "demo_fixture" | "user_supplied" | "verified_upload" | "repository";
  createdAt: string;
}

class ArtifactRepository {
  create(input: Omit<ExperimentArtifact, "id" | "createdAt">): ExperimentArtifact {
    const artifact = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    db.prepare(`INSERT INTO experiment_artifacts
      (id, experiment_id, kind, uri, content_hash, metadata_json, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(artifact.id, artifact.experimentId, artifact.kind,
      artifact.uri, artifact.contentHash, JSON.stringify(artifact.metadata), artifact.source, artifact.createdAt);
    return artifact;
  }

  list(experimentId: string): ExperimentArtifact[] {
    const rows = db.prepare("SELECT * FROM experiment_artifacts WHERE experiment_id = ? ORDER BY created_at, rowid").all(experimentId) as any[];
    return rows.map((row) => ({ id: row.id, experimentId: row.experiment_id, kind: row.kind,
      uri: row.uri, contentHash: row.content_hash, metadata: JSON.parse(row.metadata_json),
      source: row.source, createdAt: row.created_at }));
  }

  createUploadedFile(input: { experimentId: string; kind: ArtifactKind; originalName: string;
    mediaType: string; content: Buffer; metadata: Record<string, unknown> }): ExperimentArtifact {
    return db.transaction(() => {
      const artifact = this.create({ experimentId: input.experimentId, kind: input.kind,
        uri: null, contentHash: crypto.createHash("sha256").update(input.content).digest("hex"),
        metadata: input.metadata, source: "verified_upload" });
      db.prepare(`INSERT INTO experiment_artifact_files (artifact_id, original_name, media_type, content)
        VALUES (?, ?, ?, ?)`).run(artifact.id, input.originalName, input.mediaType, input.content);
      const uri = `/api/v1/experiments/${input.experimentId}/artifacts/${artifact.id}/file`;
      db.prepare("UPDATE experiment_artifacts SET uri = ? WHERE id = ?").run(uri, artifact.id);
      return { ...artifact, uri };
    })();
  }

  findFile(experimentId: string, artifactId: string): { name: string; mediaType: string; content: Buffer } | null {
    const row = db.prepare(`SELECT f.original_name, f.media_type, f.content FROM experiment_artifact_files f
      JOIN experiment_artifacts a ON a.id = f.artifact_id
      WHERE a.experiment_id = ? AND a.id = ?`).get(experimentId, artifactId) as any;
    return row ? { name: row.original_name, mediaType: row.media_type, content: row.content } : null;
  }

  hasValidFile(experimentId: string, artifactId: string, expectedHash: string | null): boolean {
    const file = this.findFile(experimentId, artifactId);
    return Boolean(file && expectedHash && crypto.createHash("sha256").update(file.content).digest("hex") === expectedHash);
  }

  setPolicy(experimentId: string, policyId: string): void {
    db.prepare(`INSERT INTO experiment_policies (experiment_id, policy_id, created_at) VALUES (?, ?, ?)
      ON CONFLICT(experiment_id) DO UPDATE SET policy_id = excluded.policy_id`).run(experimentId, policyId, new Date().toISOString());
  }

  getPolicy(experimentId: string): string | null {
    const row = db.prepare("SELECT policy_id FROM experiment_policies WHERE experiment_id = ?").get(experimentId) as { policy_id: string } | undefined;
    return row?.policy_id ?? null;
  }
}

export const artifactRepository = new ArtifactRepository();
