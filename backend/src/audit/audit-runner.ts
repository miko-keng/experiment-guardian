import { Experiment, ExperimentStatus } from "../extraction/experiment-schema.js";
import { AuditFinding, AuditResult, AuditRule } from "./audit-types.js";
import { missingControlsRule } from "./rules/missing-controls.js";
import { confoundingChangesRule } from "./rules/confounding-changes.js";

export class AuditRunner {
  private rules: AuditRule[] = [missingControlsRule, confoundingChangesRule];

  registerRule(rule: AuditRule): void {
    this.rules.push(rule);
  }

  evaluate(experiment: Experiment, history: Experiment[] = []): AuditResult {
    const allFindings: AuditFinding[] = [];

    for (const rule of this.rules) {
      try {
        const findings = rule.evaluate(experiment, history);
        allFindings.push(...findings);
      } catch (err) {
        console.error(`Audit rule ${rule.id} failed:`, err);
      }
    }

    const summary = {
      critical: allFindings.filter((f) => f.severity === "critical").length,
      warning: allFindings.filter((f) => f.severity === "warning").length,
      info: allFindings.filter((f) => f.severity === "info").length,
      open: allFindings.filter((f) => f.status === "open").length,
    };

    return {
      experimentId: experiment.id,
      findings: allFindings,
      summary,
      auditVersion: "1.0.0",
      completedAt: new Date().toISOString(),
    };
  }

  deriveStatus(auditResult: AuditResult): ExperimentStatus {
    if (auditResult.summary.open > 0) {
      return "needs_review";
    }
    return "audited";
  }
}

export const auditRunner = new AuditRunner();
