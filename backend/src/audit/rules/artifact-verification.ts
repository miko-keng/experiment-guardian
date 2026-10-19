import crypto from "crypto";
import { artifactRepository, type ExperimentArtifact } from "../../database/artifact-repository.js";
import type { Experiment } from "../../extraction/experiment-schema.js";
import type { AuditFinding, AuditRule } from "../audit-types.js";
import { RULE_IDS } from "../audit-types.js";
import { mlResearchPolicy } from "../policies/ml-research.js";

function finding(experiment: Experiment, ruleId: string, title: string, fieldPath: string,
  claim: unknown, observed: unknown, artifact: ExperimentArtifact | null, recommendation: string): AuditFinding {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), experimentId: experiment.id, ruleId, title,
    description: artifact
      ? `The research record says ${JSON.stringify(claim)}, while stored ${artifact.kind} metadata says ${JSON.stringify(observed)}.`
      : `No ${title.toLowerCase()} is linked to this experiment.`,
    severity: "critical", status: "open", recommendation, resolutionNote: null, createdAt: now, updatedAt: now,
    evidence: [{ type: artifact ? "artifact_metadata" : "experiment_field", experimentId: experiment.id,
      fieldPath, description: artifact ? `Stored ${artifact.kind} (${artifact.source})` : "Required artifact is absent",
      excerpt: null, previousValue: claim, currentValue: observed, sourceReference: artifact?.uri ?? null }],
  };
}

export const artifactVerificationRule: AuditRule = {
  id: "ML_ARTIFACT_VERIFICATION",
  description: "Compares recorded claims with persisted run metadata and required evidence artifacts.",
  evaluate(experiment) {
    if (artifactRepository.getPolicy(experiment.id) !== mlResearchPolicy.id) return [];
    const artifacts = artifactRepository.list(experiment.id);
    const first = (kind: ExperimentArtifact["kind"]) => [...artifacts].reverse().find((item) => item.kind === kind) ?? null;
    const run = first("run_manifest");
    const dataset = first("dataset_manifest");
    const config = first("training_config");
    const results: AuditFinding[] = [];

    for (const artifact of artifacts) {
      if (artifact.source === "verified_upload" &&
        !artifactRepository.hasValidFile(experiment.id, artifact.id, artifact.contentHash)) {
        results.push(finding(experiment, RULE_IDS.ARTIFACT_HASH_MISMATCH,
          "Stored artifact file hash mismatch", artifact.kind, artifact.contentHash, "invalid", artifact,
          "Replace the damaged artifact file and rerun the audit."));
      }
    }
    if (run && typeof run.metadata.randomSeed !== "number") {
      results.push(finding(experiment, RULE_IDS.MISSING_RUN_SEED, "Random seed missing from run manifest",
        "training.randomSeed", experiment.training.randomSeed, null, run,
        "Attach a run manifest containing the actual randomSeed number."));
    }
    if (dataset && (typeof dataset.metadata.datasetVersion !== "string" ||
      typeof dataset.metadata.datasetHash !== "string")) {
      results.push(finding(experiment, RULE_IDS.MISSING_DATASET_METADATA, "Dataset version or hash missing from manifest",
        "dataset.datasetVersion", experiment.dataset.datasetVersion, null, dataset,
        "Attach a dataset manifest containing datasetVersion and datasetHash."));
    }

    if (run && typeof run.metadata.randomSeed === "number" && experiment.training.randomSeed !== run.metadata.randomSeed) {
      results.push(finding(experiment, RULE_IDS.SEED_MISMATCH, "Random seed conflicts with run manifest",
        "training.randomSeed", experiment.training.randomSeed, run.metadata.randomSeed, run,
        "Check the run configuration and approve a correction to the research record or attach the correct manifest."));
    }
    const datasetVersionConflict = dataset && typeof dataset.metadata.datasetVersion === "string" &&
      experiment.dataset.datasetVersion !== dataset.metadata.datasetVersion;
    const datasetHashConflict = dataset && typeof dataset.metadata.datasetHash === "string" &&
      experiment.dataset.datasetIdentifier !== null && experiment.dataset.datasetIdentifier !== dataset.metadata.datasetHash;
    if (dataset && (datasetVersionConflict || datasetHashConflict)) {
      results.push(finding(experiment, RULE_IDS.DATASET_VERSION_MISMATCH, "Dataset version or hash conflicts with manifest",
        "dataset.datasetVersion", `${experiment.dataset.datasetVersion ?? "unknown"} / ${experiment.dataset.datasetIdentifier ?? "no hash"}`,
        `${String(dataset.metadata.datasetVersion ?? "unknown")} / ${String(dataset.metadata.datasetHash ?? "no hash")}`, dataset,
        "Confirm the dataset version and hash, then correct the record or attach the matching manifest."));
    }
    if (config && (config.metadata.learningRate === null || config.metadata.learningRate === undefined)) {
      results.push(finding(experiment, RULE_IDS.MISSING_TRAINING_PARAMETER, "Learning rate missing from training configuration",
        "training.learningRate", experiment.training.learningRate, null, config,
        "Record the actual learning rate in the training configuration artifact."));
    } else if (config && typeof config.metadata.learningRate === "number" &&
      experiment.training.learningRate !== config.metadata.learningRate) {
      results.push(finding(experiment, RULE_IDS.MISSING_TRAINING_PARAMETER, "Learning rate conflicts with training configuration",
        "training.learningRate", experiment.training.learningRate, config.metadata.learningRate, config,
        "Inspect the training configuration and approve a correction or attach the right artifact."));
    }

    for (const [kind, id, title, field] of [
      ["run_manifest", RULE_IDS.MISSING_RUN_MANIFEST, "Run manifest", "training.randomSeed"],
      ["dataset_manifest", RULE_IDS.MISSING_DATASET_MANIFEST, "Dataset manifest", "dataset.datasetVersion"],
      ["training_config", RULE_IDS.MISSING_TRAINING_CONFIG, "Training configuration", "training.learningRate"],
      ["evaluation_script", RULE_IDS.MISSING_EVALUATION_SCRIPT, "Evaluation script", "evaluation.evaluationProcedure"],
      ["evaluation_result", RULE_IDS.MISSING_RESULT_ARTIFACT, "Result artifact", "evaluation.metrics"],
      ["model_checkpoint", RULE_IDS.MISSING_MODEL_CHECKPOINT, "Model checkpoint", "model.modelVersion"],
      ["dependency_lock", RULE_IDS.MISSING_DEPENDENCY_LOCK, "Dependency lockfile", "training.frameworkVersion"],
    ] as const) {
      if (!first(kind)) results.push(finding(experiment, id, title, field, null, null, null,
        `Attach the ${title.toLowerCase()} or document why it is not required under this policy.`));
    }
    const result = first("evaluation_result");
    const claimedAccuracy = experiment.evaluation.metrics.accuracy;
    if (result && typeof claimedAccuracy === "number" && typeof result.metadata.accuracy !== "number") {
      results.push(finding(experiment, RULE_IDS.MISSING_RESULT_METRIC, "Accuracy missing from result artifact",
        "evaluation.metrics.accuracy", claimedAccuracy, null, result,
        "Attach evaluation output containing the measured accuracy."));
    }
    if (result && typeof claimedAccuracy === "number" && typeof result.metadata.accuracy === "number" &&
      Math.abs(claimedAccuracy - result.metadata.accuracy) > 0.000001) {
      results.push(finding(experiment, RULE_IDS.RESULT_METRIC_MISMATCH, "Reported accuracy conflicts with result artifact",
        "evaluation.metrics.accuracy", claimedAccuracy, result.metadata.accuracy, result,
        "Inspect the evaluation output and correct the reported metric or attach the matching result."));
    }
    return results;
  },
};
