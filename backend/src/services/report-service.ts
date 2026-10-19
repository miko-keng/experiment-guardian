import { experimentService } from "./experiment-service.js";
import { auditService } from "./audit-service.js";
import { revisionService } from "./revision-service.js";
import { decisionRepository } from "../database/decision-repository.js";
import { reportRepository } from "../database/report-repository.js";
import { getVerification } from "./verification-service.js";
import { BedrockIntegrationError } from "../integrations/bedrock/bedrock-errors.js";
import { linkedEvidenceRepository } from "../database/linked-evidence-repository.js";

export class ReportService {
  generate(experimentId: string, format: "markdown" | "json" = "markdown") {
    const experiment = experimentService.getExperiment(experimentId);
    if (!experiment) throw new BedrockIntegrationError("NOT_FOUND", "Experiment not found", undefined, 404);
    const findings = auditService.getFindingsForExperiment(experimentId);
    const runs = auditService.getAuditHistory(experimentId);
    const revisions = revisionService.list(experimentId);
    const decisions = decisionRepository.listByExperiment(experimentId);
    const verification = getVerification(experimentId);
    const linkedEvidence = linkedEvidenceRepository.list(experimentId);
    const payload = { experiment, audit: runs[0] || null, findings, revisions, decisions,
      verification, linkedEvidence, generatedAt: new Date().toISOString() };
    const content = format === "json" ? JSON.stringify(payload, null, 2) : this.markdown(payload);
    return reportRepository.create({ experimentId, auditRunId: runs[0]?.id || null, format, content });
  }

  private markdown(data: any) {
    const e = data.experiment;
    const open = data.findings.filter((f: any) => f.status === "open");
    const verification = data.verification;
    return `# Reproducibility Report: ${e.title}

Generated: ${data.generatedAt}

## Experiment claims

- Model: ${e.model.modelName || e.model.architecture || "Not recorded"}
- Dataset: ${e.dataset.datasetName || "Not recorded"} ${e.dataset.datasetVersion || ""}
- Learning rate: ${e.training.learningRate ?? "Not recorded"}
- Random seed: ${e.training.randomSeed ?? "Not recorded"}
- Claimed accuracy: ${e.evaluation.metrics.accuracy ?? "Not recorded"}
- Code commit: ${e.evaluation.codeCommit || "Not recorded"}

## Verification and policy

- Policy: ${verification?.policyId || "No artifact policy configured"}
- Quality gate: ${verification?.qualityGate.decision || "not_configured"}
- Audit run: ${data.audit?.id || "None"}
${Object.entries(verification?.fieldStates || {}).map(([field, state]) => `- ${field}: ${state}`).join("\n") || "- No artifact verification states"}

### Linked source snapshot

${data.linkedEvidence[0] ? `- Merge request: ${data.linkedEvidence[0].gitlabMrUrl}
- Pinned commit: ${data.linkedEvidence[0].gitlabCommitSha}
- MLflow run: ${data.linkedEvidence[0].mlflowRunId}
- Fetched at: ${data.linkedEvidence[0].fetchedAt}
- Earlier snapshots retained: ${data.linkedEvidence.length - 1}` : "- No GitLab or MLflow source linked"}

### Stored artifact metadata

${verification?.artifacts.map((artifact: any) => `- ${artifact.kind} (${artifact.source}): ${artifact.uri || "No URI"}; metadata ${JSON.stringify(artifact.metadata)}`).join("\n") || "- None"}

Demo fixtures and typed metadata are labelled user_confirmed. Uploaded file bytes are retained and checked against their stored SHA-256 hash. This verifies the attached evidence file, not the scientific validity of the experiment.

## Audit

- Open findings: ${open.length}
${open.map((f: any) => `- **${f.title}** [${f.ruleId}, ${f.severity}]: ${f.description}`).join("\n") || "- No open findings"}

## Revisions

${data.revisions.map((r: any) => `- ${r.fieldPath}: ${JSON.stringify(r.previousValue)} → ${JSON.stringify(r.proposedValue)} (${r.status})`).join("\n") || "- None"}

## Decisions

${data.decisions.map((d: any) => `- ${d.statement} (${d.state})`).join("\n") || "- None"}
`;
  }
}

export const reportService = new ReportService();
