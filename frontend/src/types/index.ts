export type UUID = string;

export type ExperimentStatus =
  | "draft"
  | "auditing"
  | "audited"
  | "needs_review"
  | "failed";

export type FindingSeverity = "info" | "warning" | "critical";

export type FindingStatus = "open" | "resolved" | "accepted" | "dismissed";

export type SourceType = "manual" | "bee" | "conversation" | "meeting_notes" | "browser_voice" | "audio_transcript" | "demo";

export interface Provenance {
  sourceType: SourceType;
  sourceReference?: string | null;
  startOffset?: number | null;
  endOffset?: number | null;
  quotedEvidence?: string | null;
}

export interface ModelConfiguration {
  architecture: string | null;
  modelName: string | null;
  modelVersion: string | null;
  parameters: Record<string, unknown>;
}

export interface DatasetConfiguration {
  datasetName: string | null;
  datasetVersion: string | null;
  datasetIdentifier: string | null;
  trainSplit: string | null;
  validationSplit: string | null;
  testSplit: string | null;
  preprocessing: Record<string, unknown>;
}

export interface TrainingConfiguration {
  learningRate: number | null;
  batchSize: number | null;
  epochs: number | null;
  optimizer: string | null;
  randomSeed: number | null;
  framework: string | null;
  frameworkVersion: string | null;
  environment: Record<string, unknown>;
  otherParameters: Record<string, unknown>;
}

export interface EvaluationConfiguration {
  metrics: Record<string, number | null>;
  evaluationProcedure: string | null;
  evaluationDatasetIdentifier: string | null;
  codeCommit: string | null;
  notes: string | null;
}

export interface ExperimentSource {
  sourceType: SourceType;
  sourceId: string | null;
  sourceReference: string | null;
  transcriptText?: string | null;
  transcriptHash: string | null;
  sourceTimestamp: string | null;
}

export interface Experiment {
  id: UUID;
  title: string;
  hypothesis: string | null;
  objective: string | null;
  status: ExperimentStatus;
  model: ModelConfiguration;
  dataset: DatasetConfiguration;
  training: TrainingConfiguration;
  evaluation: EvaluationConfiguration;
  baselineExperimentId: UUID | null;
  source: ExperimentSource;
  extractedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export interface CreateExperimentRequest {
  transcript: string;
  sourceType?: SourceType;
  sourceId?: string | null;
  sourceReference?: string | null;
  baselineExperimentId?: UUID | null;
  persistTranscript?: boolean;
}

export interface CreateExperimentResponse {
  experiment: Experiment;
  audit: AuditResult;
}

export interface ListExperimentsResponse {
  items: Experiment[];
  total: number;
  limit: number;
  offset: number;
}

export interface ExperimentDetailResponse {
  experiment: Experiment;
  findings: AuditFinding[];
  baseline: Experiment | null;
  revisions: ExperimentRevision[];
  decisions: ResearchDecision[];
  auditHistory: AuditRunRecord[];
}

export type RevisionStatus = "proposed" | "applied" | "rejected";
export type RevisionAuthor = "assistant" | "user";

export interface ExperimentRevision {
  id: UUID;
  experimentId: UUID;
  fieldPath: string;
  previousValue: unknown;
  proposedValue: unknown;
  status: RevisionStatus;
  reason: string;
  evidence: AuditEvidence[];
  proposedBy: RevisionAuthor;
  reviewedAt: string | null;
  createdAt: string;
}

export type DecisionState =
  | "proposed"
  | "confirmed"
  | "rejected"
  | "abandoned"
  | "superseded";

export interface ResearchDecision {
  id: UUID;
  experimentId: UUID | null;
  state: DecisionState;
  statement: string;
  owner: string | null;
  sourceConversationId: string | null;
  evidence: AuditEvidence[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditRunRecord {
  id: UUID;
  experimentId: UUID;
  revisionId: UUID | null;
  auditVersion: string;
  summary: {
    critical: number;
    warning: number;
    info: number;
    open: number;
  };
  completedAt: string;
}

export interface HealthResponse {
  status: string;
  database: string;
  bedrockConfigured: boolean;
  beeConfigured: boolean;
  modelId?: string;
  region?: string;
  mockMode?: boolean;
}
