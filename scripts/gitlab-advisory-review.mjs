#!/usr/bin/env node

// Runs inside a GitLab merge request pipeline. Findings are advisory by default.
const guardianUrl = process.env.EXPERIMENT_GUARDIAN_URL;
const projectUrl = process.env.CI_PROJECT_URL;
const mrIid = process.env.CI_MERGE_REQUEST_IID;
const commitSha = process.env.CI_COMMIT_SHA;
if (!guardianUrl || !projectUrl || !mrIid || !commitSha) {
  console.error("Set EXPERIMENT_GUARDIAN_URL and run this job in a GitLab merge request pipeline.");
  process.exit(2);
}

const mergeRequestUrl = `${projectUrl.replace(/\/$/, "")}/-/merge_requests/${mrIid}`;
const accessPassword = process.env.EXPERIMENT_GUARDIAN_ACCESS_PASSWORD;
const headers = { Accept: "application/json" };
if (accessPassword) {
  headers.Authorization = `Basic ${Buffer.from(`researcher:${accessPassword}`).toString("base64")}`;
}
const url = new URL("/api/v1/experiments/linked-review/lookup", guardianUrl);
url.searchParams.set("mergeRequestUrl", mergeRequestUrl);
let decision = "UNAVAILABLE";
let detail = "Guardian could not read the linked review.";
let reviewUrl = guardianUrl;
try {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (response.status === 404) {
    decision = "UNLINKED";
    detail = "Open Guardian and link this merge request to an MLflow run.";
  } else if (!response.ok) {
    detail = `Guardian returned HTTP ${response.status}.`;
  } else {
    const result = await response.json();
    reviewUrl = new URL(`/experiments/${encodeURIComponent(result.experimentId)}`, guardianUrl).toString();
    const gate = result.qualityGate;
    if (gate?.linkedReview?.commitSha !== commitSha) {
      decision = "STALE";
      detail = "The linked snapshot is from a different commit. Refresh it in Guardian.";
    } else {
      decision = gate.decision === "pass" ? "PASS" : gate.decision === "warn" ? "WARN" : "FAIL";
      const ids = [...(gate.blockingRuleIds || []), ...(gate.warningRuleIds || [])];
      detail = ids.length ? `${ids.length} finding(s): ${ids.slice(0, 8).join(", ")}` : "No open policy findings.";
    }
  }
} catch (error) {
  detail = error instanceof Error ? error.message : String(error);
}

console.log(`Experiment Guardian: ${decision}`);
console.log(detail);
console.log(`Review: ${reviewUrl}`);
console.log("Advisory only: this job does not block the merge request.");

// A GitLab note makes the result visible in the merge request Overview on all tiers.
const gitlabToken = process.env.EXPERIMENT_GUARDIAN_GITLAB_TOKEN;
if (gitlabToken && process.env.CI_PROJECT_ID) {
  try {
    const api = new URL(`/api/v4/projects/${encodeURIComponent(process.env.CI_PROJECT_ID)}/merge_requests/${encodeURIComponent(mrIid)}/notes`,
      process.env.CI_SERVER_URL || "https://gitlab.com");
    const marker = `<!-- experiment-guardian:${commitSha} -->`;
    const body = `${marker}\n**Experiment Guardian: ${decision}** · ${detail}\n[Open evidence review](${reviewUrl})\n\nAdvisory result; merging remains controlled by your existing GitLab settings.`;
    const noteHeaders = { "PRIVATE-TOKEN": gitlabToken, "Content-Type": "application/json" };
    const existing = await fetch(`${api}?per_page=100`, { headers: noteHeaders, signal: AbortSignal.timeout(10000) });
    if (!existing.ok) throw new Error(`GitLab notes returned HTTP ${existing.status}`);
    const notes = await existing.json();
    const previous = Array.isArray(notes) ? notes.find((note) => typeof note.body === "string" && note.body.includes(marker)) : null;
    const target = previous ? new URL(`${api}/${previous.id}`) : api;
    const saved = await fetch(target, { method: previous ? "PUT" : "POST", headers: noteHeaders,
      body: JSON.stringify({ body }), signal: AbortSignal.timeout(10000) });
    if (!saved.ok) throw new Error(`GitLab note update returned HTTP ${saved.status}`);
    console.log("Merge request note updated.");
  } catch (error) {
    console.warn(`Could not add GitLab note: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// This is intentionally an advisory CI job. A protected, blocking gate can be added later.
process.exitCode = 0;
