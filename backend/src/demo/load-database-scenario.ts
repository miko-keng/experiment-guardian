import crypto from "crypto";
import { db } from "../database/connection.js";
import { sourceRepository } from "../database/source-repository.js";
import { experimentRepository } from "../database/experiment-repository.js";
import { artifactRepository, type ArtifactKind } from "../database/artifact-repository.js";
import { auditService } from "../services/audit-service.js";
import type { Experiment } from "../extraction/experiment-schema.js";
import { demoScenarios } from "./scenarios.js";

const databaseScenarioIds = ["database-configuration-conflict", "database-missing-result-evidence"] as const;
export function isDatabaseScenario(id: string): boolean {
  return databaseScenarioIds.some((value) => value === id);
}

export function loadDatabaseScenario(id: string) {
  const scenario = demoScenarios.find((item) => item.id === id);
  if (!scenario || !isDatabaseScenario(id)) return null;

  return db.transaction(() => {
    const now = new Date().toISOString();
    const sourceArtifact = sourceRepository.create({ sourceType: "demo", originalName: scenario.title,
      mediaType: "text/plain", text: scenario.transcript, metadata: { scenarioId: id, fixture: true } });
    const experiment: Experiment = {
      id: crypto.randomUUID(), title: scenario.title, hypothesis: null,
      objective: "Check research claims against stored run and evaluation evidence.", status: "auditing",
      model: { architecture: "image classifier", modelName: "ResNet-50", modelVersion: "v2", parameters: {} },
      dataset: { datasetName: "Image dataset", datasetVersion: "v2", datasetIdentifier: "sha256:dataset-v2-demo",
        trainSplit: "training", validationSplit: null, testSplit: "test", preprocessing: {} },
      training: { learningRate: 0.001, batchSize: 32, epochs: 20, optimizer: "Adam",
        randomSeed: 42, framework: "PyTorch", frameworkVersion: "2.7", environment: {}, otherParameters: {} },
      evaluation: { metrics: { accuracy: 0.91 }, evaluationProcedure: "Test-set accuracy",
        evaluationDatasetIdentifier: "test", codeCommit: null, notes: "Researcher reported 91% accuracy." },
      baselineExperimentId: null,
      source: { sourceType: "demo", sourceId: sourceArtifact.id, sourceReference: `demo://${id}`,
        transcriptText: scenario.transcript, transcriptHash: sourceArtifact.contentHash, sourceTimestamp: now },
      extractedAt: now, createdAt: now, updatedAt: now,
    };
    experimentRepository.create(experiment, experiment.source);
    artifactRepository.setPolicy(experiment.id, "ml-research");
    const add = (kind: ArtifactKind, metadata: Record<string, unknown>, suffix: string) =>
      artifactRepository.create({ experimentId: experiment.id, kind, metadata,
        uri: `demo://${id}/${suffix}`, contentHash: crypto.createHash("sha256").update(JSON.stringify(metadata)).digest("hex"),
        source: "demo_fixture" });

    add("run_manifest", { randomSeed: id === "database-configuration-conflict" ? 7 : 42 }, "run.json");
    add("dataset_manifest", { datasetVersion: id === "database-configuration-conflict" ? "v1" : "v2",
      datasetHash: id === "database-configuration-conflict" ? "sha256:dataset-v1-demo" : "sha256:dataset-v2-demo" }, "dataset.json");
    add("training_config", { learningRate: id === "database-configuration-conflict" ? null : 0.001 }, "training.json");
    add("dependency_lock", { path: "requirements.lock" }, "requirements.lock");
    if (id === "database-configuration-conflict") {
      add("evaluation_script", { path: "scripts/evaluate.py" }, "evaluate.py");
      add("evaluation_result", { accuracy: 0.91 }, "result.json");
      add("model_checkpoint", { path: "models/resnet-v2.bin" }, "checkpoint.bin");
    }
    const audit = auditService.runAuditForExperiment(experiment);
    return { scenario: { id: scenario.id, title: scenario.title }, experiment, audit,
      artifacts: artifactRepository.list(experiment.id), policyId: "ml-research" };
  })();
}
