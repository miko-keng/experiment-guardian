import { AuditRule, AuditFinding, RULE_IDS } from "../audit-types.js";
import { Experiment } from "../../extraction/experiment-schema.js";
import crypto from "crypto";

export const missingControlsRule: AuditRule = {
  id: "MISSING_CONTROLS",
  description: "Checks whether essential experimental controls such as random seed, dataset version, or evaluation split are documented.",
  evaluate(experiment: Experiment): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const now = new Date().toISOString();

    // Check random seed
    if (experiment.training.randomSeed === null) {
      findings.push({
        id: crypto.randomUUID(),
        experimentId: experiment.id,
        ruleId: RULE_IDS.MISSING_RANDOM_SEED,
        title: "Random seed is not recorded",
        description: "The experiment record does not contain a confirmed random seed. Variations across runs cannot be controlled or reproduced deterministically.",
        severity: "warning",
        status: "open",
        evidence: [
          {
            type: "experiment_field",
            experimentId: experiment.id,
            fieldPath: "training.randomSeed",
            description: "training.randomSeed is null",
            excerpt: null,
            previousValue: null,
            currentValue: null,
            sourceReference: null,
          },
        ],
        recommendation: "Record the seed used for this run, or explicitly mark the run as having an unknown seed in experiment metadata.",
        resolutionNote: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Check dataset version or identifier
    if (!experiment.dataset.datasetVersion && !experiment.dataset.datasetIdentifier) {
      findings.push({
        id: crypto.randomUUID(),
        experimentId: experiment.id,
        ruleId: RULE_IDS.MISSING_DATASET_VERSION,
        title: "Dataset version or identifier missing",
        description: "The experiment record specifies neither a dataset version nor an immutable dataset identifier.",
        severity: "warning",
        status: "open",
        evidence: [
          {
            type: "experiment_field",
            experimentId: experiment.id,
            fieldPath: "dataset.datasetVersion",
            description: "Neither dataset.datasetVersion nor dataset.datasetIdentifier is recorded",
            excerpt: null,
            previousValue: null,
            currentValue: null,
            sourceReference: null,
          },
        ],
        recommendation: "Record the dataset commit hash, version tag, or URI to guarantee data provenance.",
        resolutionNote: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Check evaluation split details
    if (!experiment.dataset.testSplit && !experiment.dataset.validationSplit) {
      findings.push({
        id: crypto.randomUUID(),
        experimentId: experiment.id,
        ruleId: RULE_IDS.MISSING_EVALUATION_SPLIT,
        title: "Evaluation data split not specified",
        description: "No validation or test split details were recorded for this experiment.",
        severity: "info",
        status: "open",
        evidence: [
          {
            type: "experiment_field",
            experimentId: experiment.id,
            fieldPath: "dataset.trainSplit",
            description: "Missing explicit evaluation/test split definition",
            excerpt: null,
            previousValue: null,
            currentValue: null,
            sourceReference: null,
          },
        ],
        recommendation: "Confirm which partition was used for evaluation to avoid train-test contamination.",
        resolutionNote: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return findings;
  },
};
