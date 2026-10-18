import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { app } from "../../src/app.js";
import { extractionService } from "../../src/services/extraction-service.js";
import { MockExtractor } from "../../src/integrations/bedrock/mock-extractor.js";
import { experimentService } from "../../src/services/experiment-service.js";
import { auditService } from "../../src/services/audit-service.js";
import { alexaSessionService } from "../../src/services/alexa-session-service.js";
import request from "supertest";

describe("MCP governed finding investigation", () => {
  let server: Server | undefined;
  let client: Client | undefined;

  beforeEach(() => extractionService.setExtractor(new MockExtractor()));
  afterEach(async () => {
    await client?.close().catch(() => {});
    await new Promise<void>((resolve) => server ? server.close(() => resolve()) : resolve());
  });

  it("explains without mutation, then applies an explicitly approved revision and re-audits", async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port");
    client = new Client({ name: "governed-investigation-test", version: "1.0.0" }, { capabilities: {} });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)));

    const created = await client.callTool({ name: "create_experiment_from_transcript", arguments: { transcript: "We trained ResNet-50 on ImageNet v2 with an 80/20 split, learning rate 0.001, batch size 32 for 12 epochs using PyTorch 2.4. Code commit abc1234 produced accuracy 0.87." } });
    const initial = created.structuredContent as any;
    const finding = initial.audit.findings.find((item:any) => item.ruleId === "MISSING_RANDOM_SEED");
    expect(finding).toBeDefined();

    const investigated = await client.callTool({ name: "comment_on_audit_finding", arguments: { findingId: finding.id, comment: "The random seed was 42 in the training script." } });
    const sessionId = (investigated.structuredContent as any).sessionId;
    const pendingResult = await client.callTool({ name: "get_pending_experiment_action", arguments: { sessionId } });
    const pending = (pendingResult.structuredContent as any).pending;
    expect(pending).toBeTruthy();

    const explanation = await client.callTool({ name: "continue_audit_finding_investigation", arguments: { findingId: finding.id, sessionId, message: "Why?" } });
    expect((explanation.structuredContent as any).data.modified).toBe(false);
    expect(experimentService.getExperiment(initial.experiment.id)?.training.randomSeed).toBeNull();

    await client.callTool({ name: "confirm_experiment_action", arguments: { sessionId, approvalRequestId: pending.id, decision: "approve" } });
    expect(experimentService.getExperiment(initial.experiment.id)?.training.randomSeed).toBe(42);
    expect(auditService.getFindingsForExperiment(initial.experiment.id).some((item) => item.ruleId === "MISSING_RANDOM_SEED" && item.status === "open")).toBe(false);
    expect(alexaSessionService.get(sessionId).tools.map((tool) => tool.toolName)).toEqual(expect.arrayContaining(["get_pending_experiment_action", "continue_audit_finding_investigation", "confirm_experiment_action"]));

    const detail = await request(app).get(`/api/v1/experiments/${initial.experiment.id}`).expect(200);
    const archivedFinding = detail.body.findingHistory.find((item:any) => item.id === finding.id);
    expect(archivedFinding.status).toBe("resolved");
    expect(archivedFinding.auditRunId).toBeTruthy();
    expect(detail.body.findingComments.some((item:any) => item.findingId === finding.id && item.sessionId === sessionId)).toBe(true);
    expect(alexaSessionService.get(sessionId).messages.length).toBeGreaterThan(1);
  });
});
