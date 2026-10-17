import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { MockExtractor } from "../../src/integrations/bedrock/mock-extractor.js";
import { extractionService } from "../../src/services/extraction-service.js";

describe("Phase 1 Complete Vertical Slice E2E Test", () => {
  beforeEach(() => {
    // Inject mock extractor for determinism in CI/offline testing
    extractionService.setExtractor(new MockExtractor());
  });

  it("Full workflow: Submit transcript -> Extract facts -> Validate -> Persist SQLite -> Audit -> Retrieve -> Update finding", async () => {
    // 1. Submit baseline transcript
    const baselineTranscript = `We trained ResNet-50 on ImageNet dataset v2 using 80/20 data split. The learning rate is 0.001 with AdamW optimizer, batch size 64 for 50 epochs. Random seed 42 was used.`;

    const createBaselineRes = await request(app)
      .post("/api/v1/experiments/audit")
      .send({
        transcript: baselineTranscript,
        sourceType: "manual",
        persistTranscript: true,
      });

    expect(createBaselineRes.status).toBe(201);
    const baselineExp = createBaselineRes.body.experiment;
    expect(baselineExp.id).toBeDefined();
    expect(baselineExp.training.learningRate).toBe(0.001);
    expect(baselineExp.training.randomSeed).toBe(42);
    expect(baselineExp.dataset.datasetVersion).toBe("v2");
    expect(createBaselineRes.body.audit.findings.length).toBe(0); // All controls present!
    expect(baselineExp.status).toBe("audited");

    // 2. Submit second experiment that changes multiple variables (learning rate + split) relative to baseline
    const followUpTranscript = `We adjusted our model. The learning rate is 0.01 with batch size 64 for 50 epochs. We changed to 70/30 data split.`;

    const createFollowUpRes = await request(app)
      .post("/api/v1/experiments/audit")
      .send({
        transcript: followUpTranscript,
        sourceType: "manual",
        baselineExperimentId: baselineExp.id,
      });

    expect(createFollowUpRes.status).toBe(201);
    const followUpExp = createFollowUpRes.body.experiment;
    const followUpAudit = createFollowUpRes.body.audit;

    expect(followUpExp.status).toBe("needs_review");
    expect(followUpAudit.summary.open).toBeGreaterThan(0);

    // Verify Rule 1 (Missing seed) and Rule 2 (Multiple variables changed) triggered
    const missingSeedFinding = followUpAudit.findings.find((f: any) => f.ruleId === "MISSING_RANDOM_SEED");
    expect(missingSeedFinding).toBeDefined();

    const confoundingFinding = followUpAudit.findings.find((f: any) => f.ruleId === "MULTIPLE_VARIABLES_CHANGED");
    expect(confoundingFinding).toBeDefined();
    expect(confoundingFinding.evidence.length).toBeGreaterThanOrEqual(2);

    // 3. Retrieve experiment detail
    const getDetailRes = await request(app).get(`/api/v1/experiments/${followUpExp.id}`);
    expect(getDetailRes.status).toBe(200);
    expect(getDetailRes.body.experiment.id).toBe(followUpExp.id);
    expect(getDetailRes.body.baseline.id).toBe(baselineExp.id);
    expect(getDetailRes.body.findings.length).toBe(followUpAudit.findings.length);

    // 4. Update finding status to resolved
    const updateFindingRes = await request(app)
      .patch(`/api/v1/audits/${missingSeedFinding.id}`)
      .send({
        status: "resolved",
        resolutionNote: "Confirmed seed 42 was kept from baseline in training script",
      });

    expect(updateFindingRes.status).toBe(200);
    expect(updateFindingRes.body.status).toBe("resolved");
    expect(updateFindingRes.body.resolutionNote).toBe(
      "Confirmed seed 42 was kept from baseline in training script"
    );
    expect(updateFindingRes.body.evidence.length).toBeGreaterThan(0); // Evidence preserved!
  });
});
