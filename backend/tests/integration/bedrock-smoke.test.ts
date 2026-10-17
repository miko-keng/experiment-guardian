import { describe, it, expect } from "vitest";
import { config } from "../../src/config/env.js";
import { BedrockExtractor } from "../../src/integrations/bedrock/extractor.js";
import { MockExtractor } from "../../src/integrations/bedrock/mock-extractor.js";

describe("Bedrock Extractor Suite", () => {
  it("MockExtractor extracts structured fields and preserves nulls deterministically", async () => {
    const mock = new MockExtractor();
    const transcript = "We evaluated ResNet on ImageNet with learning rate 0.01 and batch size 64 for 10 epochs. We have not decided on the data split.";
    const result = await mock.extract({
      transcript,
      sourceType: "manual",
    });

    expect(result.experiment.title).toContain("ResNet");
    expect(result.experiment.training.learningRate).toBe(0.01);
    expect(result.experiment.training.batchSize).toBe(64);
    expect(result.experiment.training.epochs).toBe(10);
    // Seed was not mentioned -> MUST be null
    expect(result.experiment.training.randomSeed).toBeNull();
    // Ambiguity captured
    expect(result.ambiguities.length).toBeGreaterThan(0);
  });

  // Live test conditional on RUN_LIVE_BEDROCK=true
  const isLiveTest = process.env.RUN_LIVE_BEDROCK === "true";
  it.skipIf(!isLiveTest)(
    "Live Bedrock Converse API invocation (Live AWS credentials required)",
    async () => {
      const extractor = new BedrockExtractor();
      const transcript = "We trained ResNet-50 with learning rate 0.001 and random seed 42 on CIFAR-10.";
      const result = await extractor.extract({
        transcript,
        sourceType: "manual",
      });

      expect(result.experiment.training.learningRate).toBe(0.001);
      expect(result.experiment.training.randomSeed).toBe(42);
      expect(result.extractionMetadata.provider).toBe("aws-bedrock");
    }
  );
});
