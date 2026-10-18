import { AuditFinding, AuditResult, FindingStatus } from "../audit/audit-types.js";
import { auditRunner } from "../audit/audit-runner.js";
import { auditRepository } from "../database/audit-repository.js";
import { experimentRepository } from "../database/experiment-repository.js";
import { Experiment, UUID } from "../extraction/experiment-schema.js";

export class AuditService {
  runAuditForExperiment(experiment: Experiment, revisionId: UUID | null = null): AuditResult {
    const history = experimentRepository.list({ limit: 100, offset: 0 }).items;
    const auditResult = auditRunner.evaluate(experiment, history);

    // Preserve every audit as an immutable run and attach its findings.
    const auditRun = auditRepository.createRun(auditResult, revisionId);
    auditRepository.createMany(auditResult.findings, auditRun.id);

    // Derive and update experiment status
    const derivedStatus = auditRunner.deriveStatus(auditResult);
    experimentRepository.update(experiment.id, { status: derivedStatus });
    experiment.status = derivedStatus;

    return auditResult;
  }

  getAuditHistory(experimentId: UUID) {
    return auditRepository.listRunsByExperiment(experimentId);
  }

  getFindingsForExperiment(experimentId: UUID): AuditFinding[] {
    return auditRepository.listByExperiment(experimentId);
  }

  getFindingHistory(experimentId: UUID): AuditFinding[] {
    return auditRepository.listHistoryByExperiment(experimentId);
  }

  updateFindingStatus(
    findingId: UUID,
    status: FindingStatus,
    resolutionNote: string | null
  ): AuditFinding | null {
    const updated = auditRepository.updateStatus(findingId, status, resolutionNote);
    if (!updated) {
      return null;
    }

    // Recalculate experiment status based on remaining open findings
    const allFindings = auditRepository.listByExperiment(updated.experimentId);
    const hasOpenFindings = allFindings.some((f) => f.status === "open");
    const newStatus = hasOpenFindings ? "needs_review" : "audited";
    experimentRepository.update(updated.experimentId, { status: newStatus });

    return updated;
  }
}

export const auditService = new AuditService();
