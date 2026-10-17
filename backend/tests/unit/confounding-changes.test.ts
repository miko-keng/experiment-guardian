import { describe, it, expect } from "vitest";
import { confoundingChangesRule } from "../../src/audit/rules/confounding-changes.js";
import { Experiment, UUID } from "../../src/extraction/experiment-schema.js";

function createMockExperiment(id: string, overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: id as UUID,
    title: `Experiment ${id}`,
    hypothesis: null,
    objective: null,
    status: "draft",
    model: {
      architecture: "Model A",
      modelName: "Model A",
      modelVersion: null,
      parameters: {},
    },
    dataset: {
      datasetName: "Data-1",
      datasetVersion: "v1",
      datasetIdentifier: null,
      trainSplit: "80%",
      validationSplit: null,
      testSplit: "20%",
      preprocessing: {},
    },
    training: {
      learningRate: 0.001,
      batchSize: 32,
      epochs: 10,
      optimizer: "AdamW",
      randomSeed: 42,
      framework: "PyTorch",
      frameworkVersion: null,
      environment: {},
      otherParameters: {},
    },
    evaluation: {
      metrics: {},
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

describe("Confounding Changes Audit Rule", () => {
  it("does not trigger when only one variable changes relative to baseline", () => {
    const baseline = createMockExperiment("base-1", {
      training: {
        ...createMockExperiment("base-1").training,
        learningRate: 0.001,
      },
    });

    const current = createMockExperiment("exp-2", {
      baselineExperimentId: "base-1" as UUID,
      training: {
        ...createMockExperiment("exp-2").training,
        learningRate: 0.01, // Single change
      },
    });

    const findings = confoundingChangesRule.evaluate(current, [baseline]);
    expect(findings.length).toBe(0);
  });

  it("flags MULTIPLE_VARIABLES_CHANGED when learning rate and dataset split both change", () => {
    const baseline = createMockExperiment("base-1", {
      dataset: {
        ...createMockExperiment("base-1").dataset,
        trainSplit: "80%",
        testSplit: "20%",
      },
      training: {
        ...createMockExperiment("base-1").training,
        learningRate: 0.001,
      },
    });

    const current = createMockExperiment("exp-2", {
      baselineExperimentId: "base-1" as UUID,
      dataset: {
        ...createMockExperiment("exp-2").dataset,
        trainSplit: "70%",
        testSplit: "30%",
      },
      training: {
        ...createMockExperiment("exp-2").training,
        learningRate: 0.01,
      },
    });

    const findings = confoundingChangesRule.evaluate(current, [baseline]);
    expect(findings.length).toBe(1);
    expect(findings[0].ruleId).toBe("MULTIPLE_VARIABLES_CHANGED");
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].evidence.length).toBe(2);
  });
});
