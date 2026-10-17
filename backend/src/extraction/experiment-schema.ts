import { z } from "zod";

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

export type ValueSource = "explicit" | "inferred" | "unknown";

export interface Provenance {
  sourceType: SourceType;
  sourceReference?: string | null;
  startOffset?: number | null;
  endOffset?: number | null;
  quotedEvidence?: string | null;
}

export interface ExtractedValue<T> {
  value: T | null;
  source: ValueSource;
  confidence: number | null;
  provenance: Provenance[];
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

export interface ExtractionAmbiguity {
  fieldPath: string;
  description: string;
  evidence: string[];
  clarificationQuestion: string | null;
}

export interface ExperimentExtractionResult {
  experiment: Omit<Experiment, "id" | "status" | "createdAt" | "updatedAt">;
  extractedFields: Record<string, Provenance[]>;
  ambiguities: ExtractionAmbiguity[];
  extractionMetadata: {
    provider: "aws-bedrock" | "mock";
    modelId: string;
    extractedAt: string;
  };
}

// Zod Schemas
export const ProvenanceSchema = z.object({
  sourceType: z.enum(["manual", "bee", "conversation", "meeting_notes", "browser_voice", "audio_transcript", "demo"]).default("manual"),
  sourceReference: z.string().nullable().optional().default(null),
  startOffset: z.number().nullable().optional().default(null),
  endOffset: z.number().nullable().optional().default(null),
  quotedEvidence: z.string().nullable().optional().default(null),
});

export const ModelConfigurationSchema = z.object({
  architecture: z.string().nullable().default(null),
  modelName: z.string().nullable().default(null),
  modelVersion: z.string().nullable().default(null),
  parameters: z.record(z.unknown()).default({}),
});

export const DatasetConfigurationSchema = z.object({
  datasetName: z.string().nullable().default(null),
  datasetVersion: z.string().nullable().default(null),
  datasetIdentifier: z.string().nullable().default(null),
  trainSplit: z.string().nullable().default(null),
  validationSplit: z.string().nullable().default(null),
  testSplit: z.string().nullable().default(null),
  preprocessing: z.record(z.unknown()).default({}),
});

export const TrainingConfigurationSchema = z.object({
  learningRate: z.number().nullable().default(null),
  batchSize: z.number().nullable().default(null),
  epochs: z.number().nullable().default(null),
  optimizer: z.string().nullable().default(null),
  randomSeed: z.number().nullable().default(null),
  framework: z.string().nullable().default(null),
  frameworkVersion: z.string().nullable().default(null),
  environment: z.record(z.unknown()).default({}),
  otherParameters: z.record(z.unknown()).default({}),
});

export const EvaluationConfigurationSchema = z.object({
  metrics: z.record(z.number().nullable()).default({}),
  evaluationProcedure: z.string().nullable().default(null),
  evaluationDatasetIdentifier: z.string().nullable().default(null),
  codeCommit: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});

export const ExperimentSourceSchema = z.object({
  sourceType: z.enum(["manual", "bee", "conversation", "meeting_notes", "browser_voice", "audio_transcript", "demo"]).default("manual"),
  sourceId: z.string().nullable().default(null),
  sourceReference: z.string().nullable().default(null),
  transcriptText: z.string().nullable().optional(),
  transcriptHash: z.string().nullable().default(null),
  sourceTimestamp: z.string().nullable().default(null),
});

export const ExtractionAmbiguitySchema = z.object({
  fieldPath: z.string(),
  description: z.string(),
  evidence: z.array(z.string()).default([]),
  clarificationQuestion: z.string().nullable().default(null),
});

export const ExperimentExtractionSchema = z.object({
  experiment: z.object({
    title: z.string().min(1).default("Untitled Experiment"),
    hypothesis: z.string().nullable().default(null),
    objective: z.string().nullable().default(null),
    model: ModelConfigurationSchema.default({}),
    dataset: DatasetConfigurationSchema.default({}),
    training: TrainingConfigurationSchema.default({}),
    evaluation: EvaluationConfigurationSchema.default({}),
    baselineExperimentId: z.string().uuid().nullable().default(null),
    source: ExperimentSourceSchema.optional(),
    extractedAt: z.string().nullable().default(null),
  }),
  extractedFields: z.record(z.array(ProvenanceSchema)).default({}),
  ambiguities: z.array(ExtractionAmbiguitySchema).default([]),
  extractionMetadata: z.object({
    provider: z.enum(["aws-bedrock", "mock"]).default("aws-bedrock"),
    modelId: z.string().default("anthropic.claude-haiku-5-5"),
    extractedAt: z.string().default(() => new Date().toISOString()),
  }).optional(),
});
