import type { UUID, FindingSeverity, FindingStatus, Experiment } from "../extraction/experiment-schema.js";

export type { FindingStatus, FindingSeverity, UUID, Experiment };

export interface AuditEvidence {
  type:
    | "transcript"
    | "experiment_field"
    | "historical_experiment"
    | "evaluation_metric"
    | "artifact_metadata";
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
  auditRunId?: UUID | null;
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
  SEED_MISMATCH: "SEED_MISMATCH",
  DATASET_VERSION_MISMATCH: "DATASET_VERSION_MISMATCH",
  MISSING_TRAINING_PARAMETER: "MISSING_TRAINING_PARAMETER",
  MISSING_EVALUATION_SCRIPT: "MISSING_EVALUATION_SCRIPT",
  MISSING_RESULT_ARTIFACT: "MISSING_RESULT_ARTIFACT",
  MISSING_MODEL_CHECKPOINT: "MISSING_MODEL_CHECKPOINT",
  RESULT_METRIC_MISMATCH: "RESULT_METRIC_MISMATCH",
  MISSING_RUN_MANIFEST: "MISSING_RUN_MANIFEST",
  MISSING_DATASET_MANIFEST: "MISSING_DATASET_MANIFEST",
  MISSING_TRAINING_CONFIG: "MISSING_TRAINING_CONFIG",
  MISSING_RESULT_METRIC: "MISSING_RESULT_METRIC",
  ARTIFACT_HASH_MISMATCH: "ARTIFACT_HASH_MISMATCH",
  MISSING_RUN_SEED: "MISSING_RUN_SEED",
  MISSING_DATASET_METADATA: "MISSING_DATASET_METADATA",
  MISSING_DEPENDENCY_LOCK: "MISSING_DEPENDENCY_LOCK",
} as const;
