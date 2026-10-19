#!/usr/bin/env node

const [baseUrl, experimentId] = process.argv.slice(2);
if (!baseUrl || !experimentId) {
  console.error("Usage: node scripts/check-quality-gate.mjs <guardian-url> <experiment-id>");
  process.exit(2);
}

try {
  const url = new URL(`/api/v1/experiments/${encodeURIComponent(experimentId)}/quality-gate`, baseUrl);
  if (!(["http:", "https:"].includes(url.protocol))) throw new Error("Guardian URL must use HTTP or HTTPS");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Quality-gate request failed: HTTP ${response.status}`);
  const gate = await response.json();
  if (!(["pass", "warn", "block", "not_configured"].includes(gate.decision))) {
    throw new Error("Quality-gate response is invalid");
  }
  console.log(`Experiment Guardian: ${gate.decision.toUpperCase()} · audit ${gate.auditRunId || "none"}`);
  for (const ruleId of gate.blockingRuleIds || []) console.log(`BLOCK ${ruleId}`);
  for (const ruleId of gate.warningRuleIds || []) console.log(`WARN ${ruleId}`);
  if (gate.note) console.log(gate.note);
  if (gate.decision === "block" || gate.decision === "not_configured" ||
    (gate.decision === "warn" && process.env.EXPERIMENT_GUARDIAN_FAIL_ON_WARN === "true")) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
