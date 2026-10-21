import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const inspectorVersion = "2.5.0";
const expectedTools = [
  "start_experiment_session",
  "add_experiment_observation",
  "get_active_experiment",
  "ask_next_reproducibility_question",
  "confirm_experiment_action",
  "pause_experiment_session",
  "resume_experiment_session",
  "finish_experiment_session",
  "create_experiment_from_transcript",
  "get_experiment",
  "get_experiment_verification",
  "list_experiments",
  "audit_experiment",
  "generate_reproducibility_report",
  "propose_experiment_revision",
  "record_research_decision",
  "comment_on_audit_finding",
  "continue_audit_finding_investigation",
  "get_pending_experiment_action",
];

const databasePath = path.join(os.tmpdir(), `experiment-guardian-inspector-${process.pid}.sqlite`);
process.env.DATABASE_PATH = databasePath;
process.env.ALLOW_MOCK_AI = "true";
process.env.NODE_ENV = "test";

const { app } = await import("../backend/dist/app.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not start the MCP trace server");
const endpoint = `http://127.0.0.1:${address.port}/mcp`;
const trace = [];

function executeInspector(method, options = []) {
  const args = [
    "--yes",
    `@modelcontextprotocol/inspector@${inspectorVersion}`,
    "--cli",
    "--server-url", endpoint,
    "--transport", "http",
    "--method", method,
    "--format", "json",
    ...options,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) return reject(new Error(`Inspector exited ${code}: ${stderr || stdout}`));
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error(`Inspector returned non-JSON output: ${stdout}\n${stderr}`)); }
    });
  });
}

function resultBody(response) {
  return response?.result || response;
}

function structured(response) {
  const body = resultBody(response);
  if (body?.structuredContent !== undefined) return body.structuredContent;
  const text = body?.content?.find?.((item) => item.type === "text")?.text;
  return text ? JSON.parse(text) : body;
}

async function call(toolName, args) {
  const startedAt = new Date().toISOString();
  const response = await executeInspector("tools/call", ["--tool-name", toolName, "--tool-args-json", JSON.stringify(args)]);
  const body = resultBody(response);
  if (body?.isError) throw new Error("MCP tool returned an application error: " + toolName);
  trace.push({ toolName, request: args, startedAt, completedAt: new Date().toISOString(), status: "passed", response: body });
  return structured(response);
}

let runError;
try {
  const listedResponse = await executeInspector("tools/list");
  const listed = resultBody(listedResponse)?.tools || [];
  const listedNames = listed.map((tool) => tool.name);
  const missing = expectedTools.filter((name) => !listedNames.includes(name));
  const unexpected = listedNames.filter((name) => !expectedTools.includes(name));
  if (missing.length || unexpected.length) throw new Error(`Tool inventory mismatch. Missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}`);

  const created = await call("create_experiment_from_transcript", {
    transcript: "We trained ResNet-50 on the Atlas Cells dataset with an 80/20 split, learning rate 0.001, batch size 32 for 12 epochs using PyTorch 2.4. Code commit abc1234 produced accuracy 0.87.",
    sourceType: "demo",
    sourceReference: "mcp-inspector://complete-tool-trace",
  });
  const experimentId = created.experiment.id;
  await call("list_experiments", { limit: 10, search: "Atlas" });
  await call("get_experiment", { experimentId });
  await call("get_experiment_verification", { experimentId });
  await call("audit_experiment", { experimentId });
  await call("generate_reproducibility_report", { experimentId, format: "markdown" });

  const started = await call("start_experiment_session", { title: "Inspector complete tool trace", experimentId });
  const sessionId = started.data.id;
  await call("get_active_experiment", { sessionId });
  await call("ask_next_reproducibility_question", { sessionId });
  await call("add_experiment_observation", { sessionId, text: "The random seed was 42 in the training script.", clientObservationId: "inspector-seed-42" });
  const pending = await call("get_pending_experiment_action", { sessionId });
  if (!pending.pending?.id) throw new Error("The observation did not create the expected governed approval");
  const confirmed = await call("confirm_experiment_action", { sessionId, approvalRequestId: pending.pending.id, decision: "approve" });
  await call("pause_experiment_session", { sessionId });
  await call("resume_experiment_session", { sessionId });
  await call("record_research_decision", { experimentId, sessionId, statement: "Use the fixed seed because the comparison must be reproducible.", state: "confirmed", owner: "demo researcher" });
  await call("propose_experiment_revision", { sessionId, experimentId, fieldPath: "evaluation.codeCommit", proposedValue: "def5678", reason: "The researcher supplied the final evaluation commit.", evidenceText: "Final evaluation used commit def5678." });

  const latestAudit = confirmed.data?.result?.audit;
  const datasetFinding = latestAudit?.findings.find((finding) => finding.ruleId === "MISSING_DATASET_VERSION") || latestAudit?.findings[0];
  if (!datasetFinding) throw new Error("No finding was available for the investigation tools");
  const investigation = await call("comment_on_audit_finding", { findingId: datasetFinding.id, comment: "The dataset version was v2. Please investigate this gap." });
  await call("continue_audit_finding_investigation", { findingId: datasetFinding.id, sessionId: investigation.sessionId, message: "Why is this needed?" });
  await call("finish_experiment_session", { sessionId });

  const called = new Set(trace.map((item) => item.toolName));
  const uncalled = expectedTools.filter((name) => !called.has(name));
  if (uncalled.length) throw new Error(`Tools not called: ${uncalled.join(", ")}`);

  const generatedAt = new Date().toISOString();
  const evidence = {
    generatedAt,
    inspector: `@modelcontextprotocol/inspector@${inspectorVersion}`,
    transport: "Streamable HTTP",
    protocolEndpoint: "/mcp",
    server: "experiment-guardian",
    summary: { listed: listedNames.length, called: trace.length, passed: trace.length, failed: 0 },
    listedTools: listedNames,
    calls: trace,
  };
  const evidenceDir = path.resolve("docs/evidence");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, "mcp-inspector-trace.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  const rows = trace.map((item, index) => `| ${index + 1} | \`${item.toolName}\` | ${item.status} | ${item.completedAt} |`).join("\n");
  const markdown = `# MCP Inspector complete tool trace\n\nGenerated: ${generatedAt}\n\nInspector: \`@modelcontextprotocol/inspector@${inspectorVersion}\`  \nTransport: Streamable HTTP at \`/mcp\`  \nResult: **${trace.length}/${expectedTools.length} tools passed**\n\nThe JSON evidence file beside this document contains each request and the complete MCP result returned by Inspector. UUIDs were generated in an isolated temporary SQLite database.\n\n| # | Tool | Result | Completed |\n|---:|---|---|---|\n${rows}\n`;
  await writeFile(path.join(evidenceDir, "mcp-inspector-trace.md"), markdown);
  console.log(`MCP Inspector trace passed: ${trace.length}/${expectedTools.length} tools. Evidence: ${evidenceDir}`);
} catch (error) {
  runError = error;
} finally {
  await new Promise((resolve) => server.close(resolve));
  await Promise.all([databasePath, `${databasePath}-wal`, `${databasePath}-shm`].map((file) => rm(file, { force: true })));
}

if (runError) throw runError;
