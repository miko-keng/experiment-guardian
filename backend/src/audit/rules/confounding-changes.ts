import { AuditRule, AuditFinding, AuditEvidence, RULE_IDS } from "../audit-types.js";
import { Experiment } from "../../extraction/experiment-schema.js";
import crypto from "crypto";

export const confoundingChangesRule: AuditRule = {
  id: "CONFOUNDING_CHANGES",
  description: "Detects when multiple variables change simultaneously between a baseline and a new run.",
  evaluate(experiment: Experiment, history: Experiment[]): AuditFinding[] {
    const findings: AuditFinding[] = [];
    if (!experiment.baselineExperimentId) {
      return findings;
    }

    const baseline = history.find((h) => h.id === experiment.baselineExperimentId);
    if (!baseline) {
      return findings;
    }

    const changes: AuditEvidence[] = [];

    // Check learning rate change
    if (
      experiment.training.learningRate !== null &&
      baseline.training.learningRate !== null &&
      experiment.training.learningRate !== baseline.training.learningRate
    ) {
      changes.push({
        type: "experiment_field",
        experimentId: experiment.id,
        fieldPath: "training.learningRate",
        description: `Learning rate changed from ${baseline.training.learningRate} to ${experiment.training.learningRate}`,
        excerpt: null,
        previousValue: baseline.training.learningRate,
        currentValue: experiment.training.learningRate,
        sourceReference: null,
      });
    }

    // Check batch size change
    if (
      experiment.training.batchSize !== null &&
      baseline.training.batchSize !== null &&
      experiment.training.batchSize !== baseline.training.batchSize
    ) {
      changes.push({
        type: "experiment_field",
        experimentId: experiment.id,
        fieldPath: "training.batchSize",
        description: `Batch size changed from ${baseline.training.batchSize} to ${experiment.training.batchSize}`,
        excerpt: null,
        previousValue: baseline.training.batchSize,
        currentValue: experiment.training.batchSize,
        sourceReference: null,
      });
    }

    // Check model architecture change
    if (
      experiment.model.architecture &&
      baseline.model.architecture &&
      experiment.model.architecture !== baseline.model.architecture
    ) {
      changes.push({
        type: "experiment_field",
        experimentId: experiment.id,
        fieldPath: "model.architecture",
        description: `Model architecture changed from ${baseline.model.architecture} to ${experiment.model.architecture}`,
        excerpt: null,
        previousValue: baseline.model.architecture,
        currentValue: experiment.model.architecture,
        sourceReference: null,
      });
    }

    // Check dataset split change
    if (
      (experiment.dataset.trainSplit && baseline.dataset.trainSplit && experiment.dataset.trainSplit !== baseline.dataset.trainSplit) ||
      (experiment.dataset.testSplit && baseline.dataset.testSplit && experiment.dataset.testSplit !== baseline.dataset.testSplit)
    ) {
      changes.push({
        type: "experiment_field",
        experimentId: experiment.id,
        fieldPath: "dataset.trainSplit",
        description: `Dataset split changed from ${baseline.dataset.trainSplit ?? "unknown"} to ${experiment.dataset.trainSplit ?? "unknown"}`,
        excerpt: null,
        previousValue: baseline.dataset.trainSplit,
        currentValue: experiment.dataset.trainSplit,
        sourceReference: null,
      });
    }

    // Check optimizer change
    if (
      experiment.training.optimizer &&
      baseline.training.optimizer &&
      experiment.training.optimizer !== baseline.training.optimizer
    ) {
      changes.push({
        type: "experiment_field",
        experimentId: experiment.id,
        fieldPath: "training.optimizer",
        description: `Optimizer changed from ${baseline.training.optimizer} to ${experiment.training.optimizer}`,
        excerpt: null,
        previousValue: baseline.training.optimizer,
        currentValue: experiment.training.optimizer,
        sourceReference: null,
      });
    }

    // If 2 or more variables changed simultaneously, flag as confounding changes
    if (changes.length >= 2) {
      const now = new Date().toISOString();
      const changedFieldNames = changes.map((c) => c.fieldPath?.replace("training.", "").replace("dataset.", "").replace("model.", "")).join(", ");

      findings.push({
        id: crypto.randomUUID(),
        experimentId: experiment.id,
        ruleId: RULE_IDS.MULTIPLE_VARIABLES_CHANGED,
        title: "Multiple experimental variables changed",
        description: `Multiple variables (${changedFieldNames}) differ from the selected baseline '${baseline.title}'. Any observed performance delta cannot be attributed to a single factor.`,
        severity: "warning",
        status: "open",
        evidence: changes,
        recommendation: "Run a controlled comparison holding all parameters constant except one, or formally document why combined modifications are intentional.",
        resolutionNote: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return findings;
  },
};
