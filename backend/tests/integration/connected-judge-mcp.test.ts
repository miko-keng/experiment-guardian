import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import request from "supertest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { app } from "../../src/app.js";
import { config } from "../../src/config/env.js";
import { IRIS_DEMO } from "../../src/services/linked-evidence-service.js";
import { auditService } from "../../src/services/audit-service.js";
import { experimentService } from "../../src/services/experiment-service.js";

describe("Connected judge review through the official MCP client", () => {
  let server: Server | undefined;
  let client: Client | undefined;
  const originalFetch = globalThis.fetch;
  const originalTrackingUrl = config.mlflowTrackingUrl;
  const sha = "2d95c4d7e9136ea70946b6cd4cca2d8edb141729";

  afterEach(async () => {
    await client?.close().catch(() => {});
    await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve());
    globalThis.fetch = originalFetch;
    config.mlflowTrackingUrl = originalTrackingUrl;
  });

  it("imports a source snapshot, negotiates MCP 2025-11-25, calls tools, and gates corrections", async () => {
    config.mlflowTrackingUrl = "https://gitlab.com/api/v4/projects/87814901/ml/mlflow";
    const configRequests: string[] = [];
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      let data: unknown;
      if (url.pathname.endsWith("/merge_requests/1")) {
        data = { sha, title: "Add Iris experiment for Guardian review" };
      } else if (url.pathname.includes("/repository/commits/")) {
        data = { id: sha, title: "Add Iris experiment", committed_date: "2026-10-19" };
      } else if (url.pathname.includes("/repository/files/")) {
        configRequests.push(url.toString());
        data = { randomSeed: 42, learningRate: 0.1 };
      } else if (url.pathname.endsWith("/api/2.0/mlflow/runs/get")) {
        data = { run: { info: { run_id: IRIS_DEMO.runId, experiment_id: "1", artifact_uri: "" },
          data: { params: [
            { key: "seed", value: "42" }, { key: "learning_rate", value: "0.1" },
            { key: "dataset_version", value: "sklearn-iris" },
            { key: "dataset_hash", value: "sha256:iris-demo" },
          ], tags: [{ key: "git.commit", value: sha }],
          metrics: [{ key: "accuracy", value: 0.8947368421052632 }] } } };
      } else {
        throw new Error(`Unexpected evidence URL: ${url.pathname}`);
      }
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    };

    const before = experimentService.listExperiments({ limit: 100, offset: 0 }).items.length;
    await request(app).post("/api/v1/experiments/linked-review/check")
      .send({ mergeRequestUrl: IRIS_DEMO.mergeRequestUrl, runId: IRIS_DEMO.runId }).expect(400);
    await request(app).post("/api/v1/experiments/linked-review/check")
      .send({ mergeRequestUrl: IRIS_DEMO.mergeRequestUrl, runId: IRIS_DEMO.runId, configFilePath: "../secrets.json" }).expect(400);
    const checked = await request(app).post("/api/v1/experiments/linked-review/check")
      .send({ mergeRequestUrl: IRIS_DEMO.mergeRequestUrl, runId: IRIS_DEMO.runId, configFilePath: "configs/iris-review.json" }).expect(200);
    expect(checked.body).toMatchObject({ previewOnly: true, commitSha: sha, runId: IRIS_DEMO.runId });
    expect(checked.body.observed.randomSeed).toBe(42);
    expect(checked.body.trainingConfigPath).toBe("configs/iris-review.json");
    expect(configRequests[0]).toContain(encodeURIComponent("configs/iris-review.json"));
    expect(new URL(configRequests[0]).searchParams.get("ref")).toBe(sha);
    expect(experimentService.listExperiments({ limit: 100, offset: 0 }).items.length).toBe(before);

    const linked = await request(app).post("/api/v1/experiments/linked-review")
      .send({ mergeRequestUrl: IRIS_DEMO.mergeRequestUrl, runId: IRIS_DEMO.runId, configFilePath: IRIS_DEMO.configFilePath, demoScenario: "iris-composite" })
      .expect(201);
    const id = linked.body.experiment.id;
    expect(linked.body.snapshot.gitlabCommitSha).toBe(sha);
    expect(linked.body.snapshot.evidence.gitlab.trainingConfigPath).toBe(IRIS_DEMO.configFilePath);
    expect(linked.body.snapshot.evidence.observed.randomSeed).toBe(42);
    expect(linked.body.audit.findings.map((item: any) => item.ruleId)).toEqual(expect.arrayContaining([
      "LINKED_SEED_MISMATCH", "LINKED_LEARNING_RATE_MISMATCH", "LINKED_DATASET_VERSION_MISMATCH",
      "MISSING_EVALUATION_SPLIT", "LINKED_MISSING_BASELINE_RUN", "LINKED_ARTIFACT_LIST_UNAVAILABLE",
    ]));

    server = app.listen(0);
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No TCP port");
    let protocolVersion: string | undefined;
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`), {
      fetch: async (input, init) => {
        const response = await originalFetch(input, init);
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body || "{}"));
          if (body.method === "initialize") {
            const raw = await response.clone().text();
            const eventData = raw.split("\n").find(line => line.startsWith("data: "));
            protocolVersion = JSON.parse(eventData ? eventData.slice(6) : raw).result?.protocolVersion;
          }
        }
        return response;
      },
    });
    client = new Client({ name: "judge-review-test", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    expect(protocolVersion).toBe("2025-11-25");
    const tools = await client.listTools();
    expect(tools.tools.map(item => item.name)).toEqual(expect.arrayContaining([
      "start_experiment_session", "get_experiment", "ask_next_reproducibility_question",
      "add_experiment_observation", "confirm_experiment_action", "finish_experiment_session",
    ]));
    const inspected = await client.callTool({ name: "get_experiment", arguments: { experimentId: id } });
    expect((inspected.structuredContent as any).experiment.training.randomSeed).toBe(7);

    const started = await client.callTool({ name: "start_experiment_session", arguments: { experimentId: id } });
    const sessionId = (started.structuredContent as any).data.id;
    const question = await client.callTool({ name: "ask_next_reproducibility_question", arguments: { sessionId } });
    expect((question.structuredContent as any).data.question).toContain("linked MLflow run says 42");
    const explanation = await client.callTool({ name: "add_experiment_observation",
      arguments: { sessionId, text: "Why was this flagged?" } });
    expect((explanation.structuredContent as any).speech.text).toContain("Rule LINKED_SEED_MISMATCH");
    expect(experimentService.getExperiment(id)?.training.randomSeed).toBe(7);
    const answer = await client.callTool({ name: "add_experiment_observation",
      arguments: { sessionId, text: "The random seed was 42 because the linked MLflow run records 42." } });
    const approvalId = (answer.structuredContent as any).data.approval.id;
    expect(experimentService.getExperiment(id)?.training.randomSeed).toBe(7);
    const pending = await client.callTool({ name: "get_pending_experiment_action", arguments: { sessionId } });
    expect((pending.structuredContent as any).pending.id).toBe(approvalId);
    await client.callTool({ name: "confirm_experiment_action",
      arguments: { sessionId, approvalRequestId: approvalId, decision: "approve" } });
    expect(experimentService.getExperiment(id)?.training.randomSeed).toBe(42);
    expect(auditService.getFindingsForExperiment(id).some(item => item.ruleId === "LINKED_SEED_MISMATCH" && item.status === "open")).toBe(false);

    const source = await request(app).post("/api/v1/sources/demo/linked-iris-review-note").expect(201);
    const note = await client.callTool({ name: "add_experiment_observation",
      arguments: { sessionId, sourceId: source.body.id, text: source.body.extractedText } });
    expect((note.structuredContent as any).data.approval).toBeTruthy();
    await client.callTool({ name: "confirm_experiment_action",
      arguments: { sessionId, approvalRequestId: (note.structuredContent as any).data.approval.id, decision: "approve" } });
    expect(experimentService.getExperiment(id)?.dataset.testSplit).toBe("25%");
    const rejected = await client.callTool({ name: "add_experiment_observation",
      arguments: { sessionId, text: "The learning rate was 0.1 because the linked MLflow run records 0.1." } });
    const rejectedId = (rejected.structuredContent as any).data.approval.id;
    await client.callTool({ name: "confirm_experiment_action",
      arguments: { sessionId, approvalRequestId: rejectedId, decision: "reject" } });
    expect(experimentService.getExperiment(id)?.training.learningRate).toBe(0.01);
    const invalid = await client.callTool({ name: "get_experiment", arguments: { experimentId: "not-a-uuid" } });
    expect(invalid.isError).toBe(true);
    const finished = await client.callTool({ name: "finish_experiment_session", arguments: { sessionId } });
    expect((finished.structuredContent as any).data.report.content).toContain("Iris");
    expect((finished.structuredContent as any).data.report.content).toContain("Iris linked review walkthrough: extracted-text SHA-256");
    expect(auditService.getFindingsForExperiment(id).some(item => item.ruleId === "LINKED_ARTIFACT_LIST_UNAVAILABLE" && item.status === "open")).toBe(true);

    const complete = await client.callTool({ name: "create_experiment_from_transcript", arguments: {
      transcript: "We trained ResNet-50 on ImageNet dataset v2 with an 80/20 split using random seed 42 and learning rate 0.001.",
    } });
    const cleanId = (complete.structuredContent as any).experiment.id;
    const cleanSession = await client.callTool({ name: "start_experiment_session", arguments: { experimentId: cleanId } });
    const cleanSessionId = (cleanSession.structuredContent as any).data.id;
    const noQuestion = await client.callTool({ name: "ask_next_reproducibility_question", arguments: { sessionId: cleanSessionId } });
    expect((noQuestion.structuredContent as any).speech.text).toBe("The current audit has no follow-up question.");
    const cleanDetail = await client.callTool({ name: "get_active_experiment", arguments: { sessionId: cleanSessionId } });
    expect((cleanDetail.structuredContent as any).messages.some((message: any) => message.content === "The current audit has no follow-up question.")).toBe(true);
  });
});
