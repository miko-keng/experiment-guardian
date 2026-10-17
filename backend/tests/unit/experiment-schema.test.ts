import { describe, it, expect } from "vitest";
import { ExperimentExtractionSchema } from "../../src/extraction/experiment-schema.js";
import { normalizeExtractionResult } from "../../src/extraction/normalize.js";

describe("ExperimentExtractionSchema & Normalization", () => {
  it("validates a minimal extraction result with nulls preserved", () => {
    const raw = {
      experiment: {
        title: "Test Run",
        hypothesis: null,
        objective: null,
        model: {
          architecture: null,
          modelName: "ResNet",
          modelVersion: null,
          parameters: {},
        },
        dataset: {
          datasetName: null,
          datasetVersion: null,
          datasetIdentifier: null,
          trainSplit: null,
          validationSplit: null,
          testSplit: null,
          preprocessing: {},
        },
        training: {
          learningRate: 0.01,
          batchSize: null,
          epochs: null,
          optimizer: null,
          randomSeed: null,
          framework: null,
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
      },
      extractedFields: {},
      ambiguities: [],
    };

    const parsed = ExperimentExtractionSchema.safeParse(raw);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      const normalized = normalizeExtractionResult(parsed.data, {
        provider: "aws-bedrock",
        modelId: "anthropic.claude-haiku-5-5",
      });

      // Verify nulls are preserved and NOT hallucinated
      expect(normalized.experiment.training.learningRate).toBe(0.01);
      expect(normalized.experiment.training.randomSeed).toBeNull();
      expect(normalized.experiment.training.batchSize).toBeNull();
      expect(normalized.experiment.dataset.datasetVersion).toBeNull();
      expect(normalized.extractionMetadata.provider).toBe("aws-bedrock");
    }
  });

  it("rejects non-numeric learningRate", () => {
    const raw = {
      experiment: {
        title: "Invalid LR",
        training: {
          learningRate: "not-a-number",
        },
      },
    };

    const parsed = ExperimentExtractionSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });
});
