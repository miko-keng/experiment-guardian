import type { UUID, FindingSeverity, FindingStatus, Experiment } from "../extraction/experiment-schema.js";

export type { FindingStatus, FindingSeverity, UUID, Experiment };

export interface AuditEvidence {
  type:
    | "transcript"
    | "experiment_field"
    | "historical_experiment"
    | "evaluation_metric";
  experimentId: UUID | null;
  fieldPath: string | null;
  description: string;
  excerpt: string | null;
  previousValue: unknown;
  currentValue: unknown;
  sourceReference: string | null;
}

export interface AuditFinding {
  id: UUID;
  experimentId: UUID;
  ruleId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  status: FindingStatus;
  evidence: AuditEvidence[];
  recommendation: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditResult {
  experimentId: UUID;
  findings: AuditFinding[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    open: number;
  };
  auditVersion: string;
  completedAt: string;
}

export interface AuditRule {
  id: string;
  description: string;
  evaluate(
    experiment: Experiment,
    history: Experiment[]
  ): AuditFinding[];
}

export const RULE_IDS = {
  MISSING_RANDOM_SEED: "MISSING_RANDOM_SEED",
  MISSING_DATASET_VERSION: "MISSING_DATASET_VERSION",
  MISSING_EVALUATION_SPLIT: "MISSING_EVALUATION_SPLIT",
  MULTIPLE_VARIABLES_CHANGED: "MULTIPLE_VARIABLES_CHANGED",
  BASELINE_CONFIGURATION_MISMATCH: "BASELINE_CONFIGURATION_MISMATCH",
  HISTORICAL_DECISION_CONFLICT: "HISTORICAL_DECISION_CONFLICT",
  UNSUPPORTED_PERFORMANCE_CLAIM: "UNSUPPORTED_PERFORMANCE_CLAIM",
} as const;
