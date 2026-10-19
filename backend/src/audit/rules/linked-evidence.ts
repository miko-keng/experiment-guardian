import crypto from "crypto";
import type { Experiment } from "../../extraction/experiment-schema.js";
import { linkedEvidenceRepository } from "../../database/linked-evidence-repository.js";
import type { AuditFinding, AuditRule } from "../audit-types.js";

function issue(experiment: Experiment, ruleId: string, title: string, fieldPath: string,
  claim: unknown, observed: unknown, sourceReference: string, severity: "critical" | "warning",
  recommendation: string): AuditFinding {
  const now = new Date().toISOString();
  const missing = observed === null || observed === undefined || observed === "";
  return {
    id: crypto.randomUUID(), experimentId: experiment.id, ruleId, title,
    description: missing
      ? `The linked run or commit does not provide ${fieldPath}.`
      : `The experiment record says ${JSON.stringify(claim)}, while the linked evidence says ${JSON.stringify(observed)}.`,
    severity, status: "open", recommendation, resolutionNote: null, createdAt: now, updatedAt: now,
    evidence: [{ type: "artifact_metadata", experimentId: experiment.id, fieldPath,
      description: "Read-only GitLab or MLflow snapshot", excerpt: null,
      previousValue: claim, currentValue: observed, sourceReference }],
  };
}

export const linkedEvidenceRule: AuditRule = {
  id: "LINKED_EVIDENCE",
  description: "Compares experiment claims with a pinned GitLab merge request and MLflow run snapshot.",
  evaluate(experiment) {
    const snapshot = linkedEvidenceRepository.latest(experiment.id);
    if (!snapshot) return [];
    const evidence = snapshot.evidence;
    const observed = evidence.observed || {};
    const source = evidence.source || {};
    const findings: AuditFinding[] = [];
    const compare = (ruleId: string, title: string, field: string, claim: unknown,
      actual: unknown, link: string, required = true) => {
      if (actual === null || actual === undefined || actual === "") {
        findings.push(issue(experiment, `LINKED_MISSING_${ruleId}`, `${title} missing from linked evidence`,
          field, claim, null, link, required ? "critical" : "warning",
          "Log this value with the run, then refresh the linked evidence."));
      } else if (claim !== null && claim !== undefined && claim !== "" && String(claim) !== String(actual)) {
        findings.push(issue(experiment, `LINKED_${ruleId}_MISMATCH`, `${title} conflicts with linked evidence`,
          field, claim, actual, link, "critical",
          "Link the correct run or propose and approve a correction to the experiment record."));
      }
    };
    compare("SEED", "Random seed", "training.randomSeed", experiment.training.randomSeed,
      observed.randomSeed, source.run);
    compare("LEARNING_RATE", "Learning rate", "training.learningRate", experiment.training.learningRate,
      observed.learningRate, source.run);
    compare("DATASET_VERSION", "Dataset version", "dataset.datasetVersion", experiment.dataset.datasetVersion,
      observed.datasetVersion, source.run);
    compare("DATASET_HASH", "Dataset hash", "dataset.datasetIdentifier", experiment.dataset.datasetIdentifier,
      observed.datasetHash, source.run);
    compare("ACCURACY", "Accuracy", "evaluation.metrics.accuracy", experiment.evaluation.metrics.accuracy,
      observed.accuracy, source.run);
    compare("RUN_COMMIT", "Run code commit", "evaluation.codeCommit", snapshot.gitlabCommitSha,
      observed.codeCommit, source.run);
    compare("RECORD_COMMIT", "Recorded code commit", "evaluation.codeCommit", experiment.evaluation.codeCommit,
      snapshot.gitlabCommitSha, source.commit, false);
    if (!observed.baselineRunId) {
      findings.push(issue(experiment, "LINKED_MISSING_BASELINE_RUN", "Baseline run not logged",
        "baselineExperimentId", experiment.baselineExperimentId, null, source.run, "warning",
        "Log baseline_run_id on the MLflow run when comparing against a previous model."));
    }
    if (observed.configRandomSeed !== null && observed.configRandomSeed !== undefined &&
      observed.randomSeed !== null && observed.randomSeed !== undefined &&
      observed.configRandomSeed !== observed.randomSeed) {
      findings.push(issue(experiment, "LINKED_CONFIG_SEED_MISMATCH", "GitLab config and run seed differ",
        "training.randomSeed", observed.configRandomSeed, observed.randomSeed, source.config,
        "critical", "Inspect the pinned training config and linked run; link the matching run."));
    }
    if (observed.configLearningRate !== null && observed.configLearningRate !== undefined &&
      observed.learningRate !== null && observed.learningRate !== undefined &&
      observed.configLearningRate !== observed.learningRate) {
      findings.push(issue(experiment, "LINKED_CONFIG_LEARNING_RATE_MISMATCH", "GitLab config and run learning rate differ",
        "training.learningRate", observed.configLearningRate, observed.learningRate, source.config,
        "critical", "Inspect the pinned training config and linked run; link the matching run."));
    }
    if (!evidence.gitlab?.trainingConfig) {
      findings.push(issue(experiment, "LINKED_MISSING_TRAINING_CONFIG", "Training config missing at pinned commit",
        "training.environment", null, null, source.commit, "warning",
        "Add experiment-guardian.json to the merge request or configure the training config path."));
    }
    const artifacts = (evidence.mlflow?.artifacts || []) as Array<{ path: string }>;
    for (const [name, pattern] of [
      ["evaluation script", /(^|\/)(eval|evaluate|evaluation)[^/]*\.(py|ipynb)$/i],
      ["model checkpoint", /\.(pt|pth|ckpt|pkl|onnx|safetensors)$/i],
      ["dependency lockfile", /(^|\/)(requirements[^/]*\.txt|poetry\.lock|uv\.lock|environment\.ya?ml)$/i],
    ] as const) {
      if (!artifacts.some((item) => pattern.test(item.path))) {
        findings.push(issue(experiment, `LINKED_MISSING_${name.toUpperCase().replace(/ /g, "_")}`,
          `${name} not listed with linked run`, "mlflow.artifacts", null, null,
          source.run, "warning", `Log the ${name} as a run artifact or document where it is stored.`));
      }
    }
    if (experiment.baselineExperimentId) {
      const baseline = linkedEvidenceRepository.latest(experiment.baselineExperimentId);
      if (!baseline || baseline.mlflowRunId !== observed.baselineRunId) {
        findings.push(issue(experiment, "LINKED_BASELINE_RUN_MISMATCH", "Baseline run is not linked consistently",
          "baselineExperimentId", baseline?.mlflowRunId || null, observed.baselineRunId || null,
          source.run, "warning", "Log baseline_run_id on the run or link the correct baseline experiment."));
      }
    }
    return findings;
  },
};
