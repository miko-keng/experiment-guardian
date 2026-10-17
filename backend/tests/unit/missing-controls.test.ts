import { describe, it, expect } from "vitest";
import { missingControlsRule } from "../../src/audit/rules/missing-controls.js";
import { Experiment, UUID } from "../../src/extraction/experiment-schema.js";

function createBaseExperiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: "exp-1" as UUID,
    title: "Baseline test",
    hypothesis: null,
    objective: null,
    status: "draft",
    model: {
      architecture: "Transformer",
      modelName: "Model-X",
      modelVersion: null,
      parameters: {},
    },
    dataset: {
      datasetName: "GLUE",
      datasetVersion: "v1",
      datasetIdentifier: "huggingface:glue",
      trainSplit: "train",
      validationSplit: "dev",
      testSplit: "test",
      preprocessing: {},
    },
    training: {
      learningRate: 0.001,
      batchSize: 32,
      epochs: 5,
      optimizer: "AdamW",
      randomSeed: 42,
      framework: "PyTorch",
      frameworkVersion: null,
      environment: {},
      otherParameters: {},
    },
    evaluation: {
      metrics: { accuracy: 0.92 },
      evaluationProcedure: null,
      evaluationDatasetIdentifier: null,
      codeCommit: null,
      notes: null,
    },
    baselineExperimentId: null,
    source: {
      sourceType: "manual",
      sourceId: null,
      sourceReference: null,
      transcriptHash: null,
      sourceTimestamp: null,
    },
    extractedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Missing Controls Audit Rule", () => {
  it("produces no warnings when all controls (seed, dataset version, split) are present", () => {
    const exp = createBaseExperiment();
    const findings = missingControlsRule.evaluate(exp, []);
    expect(findings.length).toBe(0);
  });

  it("flags MISSING_RANDOM_SEED when random seed is null", () => {
    const exp = createBaseExperiment({
      training: {
        ...createBaseExperiment().training,
        randomSeed: null,
      },
    });

    const findings = missingControlsRule.evaluate(exp, []);
    const seedFinding = findings.find((f) => f.ruleId === "MISSING_RANDOM_SEED");
    expect(seedFinding).toBeDefined();
    expect(seedFinding?.severity).toBe("warning");
    expect(seedFinding?.status).toBe("open");
  });

  it("flags MISSING_DATASET_VERSION when dataset version and identifier are null", () => {
    const exp = createBaseExperiment({
      dataset: {
        ...createBaseExperiment().dataset,
        datasetVersion: null,
        datasetIdentifier: null,
      },
    });

    const findings = missingControlsRule.evaluate(exp, []);
    const versionFinding = findings.find((f) => f.ruleId === "MISSING_DATASET_VERSION");
    expect(versionFinding).toBeDefined();
    expect(versionFinding?.severity).toBe("warning");
  });
});
