import { artifactRepository, type ExperimentArtifact } from "../database/artifact-repository.js";
import { auditRepository } from "../database/audit-repository.js";
import { experimentRepository } from "../database/experiment-repository.js";
import { mlResearchPolicy } from "../audit/policies/ml-research.js";
import { linkedEvidenceRepository } from "../database/linked-evidence-repository.js";

export type VerificationState = "verified" | "source_linked" | "user_confirmed" | "missing" | "conflict" | "not_applicable";

function artifactState(artifact: ExperimentArtifact | undefined): VerificationState {
  if (!artifact) return "missing";
  if (artifact.source === "verified_upload") {
    return artifactRepository.hasValidFile(artifact.experimentId, artifact.id, artifact.contentHash)
      ? "verified" : "conflict";
  }
  // Demo fixtures and typed metadata are claims, not independent file checks.
  return "user_confirmed";
}

export function getVerification(experimentId: string) {
  const experiment = experimentRepository.findById(experimentId);
  if (!experiment) return null;
  const policyId = artifactRepository.getPolicy(experimentId);
  const linkedReview = linkedEvidenceRepository.latest(experimentId);
  const artifacts = artifactRepository.list(experimentId);
  const latest = (kind: ExperimentArtifact["kind"]) => [...artifacts].reverse().find((item) => item.kind === kind);
  const run = latest("run_manifest");
  const dataset = latest("dataset_manifest");
  const config = latest("training_config");
  const result = latest("evaluation_result");
  const fieldStates: Record<string, VerificationState> = {};
  if (linkedReview) {
    for (const [field, claim, actual] of [
      ["training.randomSeed", experiment.training.randomSeed, linkedReview.evidence.observed.randomSeed],
      ["training.learningRate", experiment.training.learningRate, linkedReview.evidence.observed.learningRate],
      ["dataset.datasetVersion", experiment.dataset.datasetVersion, linkedReview.evidence.observed.datasetVersion],
      ["dataset.datasetIdentifier", experiment.dataset.datasetIdentifier, linkedReview.evidence.observed.datasetHash],
      ["evaluation.metrics.accuracy", experiment.evaluation.metrics.accuracy, linkedReview.evidence.observed.accuracy],
      ["evaluation.codeCommit", linkedReview.gitlabCommitSha, linkedReview.evidence.observed.codeCommit],
    ] as const) {
      fieldStates[field] = actual === null || actual === undefined || actual === "" ? "missing"
        : claim !== null && claim !== undefined && claim !== "" && String(claim) !== String(actual)
          ? "conflict" : "source_linked";
    }
  }
  if (policyId === mlResearchPolicy.id) {
    fieldStates["training.randomSeed"] = run && typeof run.metadata.randomSeed !== "number" ? "missing" :
      run && run.metadata.randomSeed !== experiment.training.randomSeed ? "conflict" : artifactState(run);
    fieldStates["dataset.datasetVersion"] = dataset && (typeof dataset.metadata.datasetVersion !== "string" ||
      typeof dataset.metadata.datasetHash !== "string") ? "missing" : dataset && (
      (typeof dataset.metadata.datasetVersion === "string" && dataset.metadata.datasetVersion !== experiment.dataset.datasetVersion) ||
      (typeof dataset.metadata.datasetHash === "string" && experiment.dataset.datasetIdentifier !== null &&
        dataset.metadata.datasetHash !== experiment.dataset.datasetIdentifier)) ? "conflict" : artifactState(dataset);
    fieldStates["training.learningRate"] = config && (config.metadata.learningRate === null ||
      config.metadata.learningRate === undefined) ? "missing" : config &&
      config.metadata.learningRate !== experiment.training.learningRate ? "conflict" : artifactState(config);
    fieldStates["evaluation.evaluationProcedure"] = artifactState(latest("evaluation_script"));
    fieldStates["evaluation.metrics.accuracy"] = result && typeof result.metadata.accuracy === "number" &&
      result.metadata.accuracy !== experiment.evaluation.metrics.accuracy ? "conflict" : artifactState(result);
    fieldStates["model.checkpoint"] = artifactState(latest("model_checkpoint"));
    fieldStates["training.dependencyLock"] = artifactState(latest("dependency_lock"));
  }
  const findings = auditRepository.listByExperiment(experimentId);
  const audit = auditRepository.listRunsByExperiment(experimentId)[0] ?? null;
  const blocking = policyId === mlResearchPolicy.id || policyId === "linked-ml-review"
    ? findings.filter((item) => item.severity === "critical" && item.status === "open") : [];
  const warnings = findings.filter((item) => item.severity === "warning" && item.status === "open");
  const missingOrConflicting = Object.entries(fieldStates).filter(([, state]) => state === "missing" || state === "conflict").map(([field]) => field);
  const unverified = Object.entries(fieldStates).filter(([, state]) => state === "user_confirmed").map(([field]) => field);
  const decision = !policyId ? "not_configured" : !audit || blocking.length || missingOrConflicting.length ? "block" : warnings.length || unverified.length ? "warn" : "pass";
  return { policyId, fieldStates, artifacts, qualityGate: { decision,
    auditRunId: audit?.id ?? null, blockingRuleIds: blocking.map((item) => item.ruleId),
    warningRuleIds: warnings.map((item) => item.ruleId), unverifiedFieldPaths: unverified,
    linkedReview: linkedReview ? { snapshotId: linkedReview.id, mergeRequestUrl: linkedReview.gitlabMrUrl,
      commitSha: linkedReview.gitlabCommitSha, runId: linkedReview.mlflowRunId,
      fetchedAt: linkedReview.fetchedAt } : null,
    note: blocking.length ? "Critical findings remain blocking even if marked accepted; authorized overrides are not configured."
      : unverified.length ? "Some fields match only demo or user-supplied metadata; upload the underlying files for a verified evidence state." : null } };
}
