import crypto from "crypto";
import { config } from "../config/env.js";
import { experimentRepository } from "../database/experiment-repository.js";
import { extractionService } from "./extraction-service.js";
import { auditService } from "./audit-service.js";
import {
  Experiment,
  ExperimentSource,
  ExperimentStatus,
  SourceType,
  UUID,
} from "../extraction/experiment-schema.js";
import { AuditResult } from "../audit/audit-types.js";
import { BedrockIntegrationError } from "../integrations/bedrock/bedrock-errors.js";

export interface CreateExperimentInput {
  transcript: string;
  sourceType?: SourceType;
  sourceId?: string | null;
  sourceReference?: string | null;
  baselineExperimentId?: UUID | null;
  persistTranscript?: boolean;
}

export interface CreateAndAuditResponse {
  experiment: Experiment;
  audit: AuditResult;
}

export class ExperimentService {
  async createAndAudit(input: CreateExperimentInput): Promise<CreateAndAuditResponse> {
    const transcript = input.transcript ? input.transcript.trim() : "";
    if (!transcript) {
      throw new BedrockIntegrationError("INVALID_INPUT", "Transcript cannot be empty", undefined, 400);
    }

    if (transcript.length > config.maxTranscriptCharacters) {
      throw new BedrockIntegrationError(
        "INPUT_TOO_LARGE",
        `Transcript length (${transcript.length}) exceeds maximum limit (${config.maxTranscriptCharacters})`,
        undefined,
        400
      );
    }

    if (input.baselineExperimentId) {
      const baseline = experimentRepository.findById(input.baselineExperimentId);
      if (!baseline) {
        throw new BedrockIntegrationError(
          "BASELINE_NOT_FOUND",
          `Specified baseline experiment '${input.baselineExperimentId}' does not exist`,
          undefined,
          404
        );
      }
    }

    // Hash transcript for audit trail & integrity
    const transcriptHash = crypto.createHash("sha256").update(transcript).digest("hex");
    const sourceType: SourceType = input.sourceType || "manual";
    const persistText = input.persistTranscript !== undefined ? input.persistTranscript : config.persistTranscripts;

    // Call Bedrock (or mock if configured)
    const extractionResult = await extractionService.extract({
      transcript,
      sourceType,
      sourceId: input.sourceId,
      sourceReference: input.sourceReference,
    });

    const experimentId = crypto.randomUUID();
    const now = new Date().toISOString();

    const source: ExperimentSource = {
      sourceType,
      sourceId: input.sourceId || null,
      sourceReference: input.sourceReference || null,
      transcriptText: persistText ? transcript : null,
      transcriptHash,
      sourceTimestamp: now,
    };

    const experiment: Experiment = {
      id: experimentId,
      title: extractionResult.experiment.title || "Untitled Experiment",
      hypothesis: extractionResult.experiment.hypothesis,
      objective: extractionResult.experiment.objective,
      status: "auditing",
      model: extractionResult.experiment.model,
      dataset: extractionResult.experiment.dataset,
      training: extractionResult.experiment.training,
      evaluation: extractionResult.experiment.evaluation,
      baselineExperimentId: input.baselineExperimentId || extractionResult.experiment.baselineExperimentId || null,
      source,
      extractedAt: extractionResult.extractionMetadata?.extractedAt || now,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Persist experiment in SQLite
    experimentRepository.create(experiment, source);

    // 2. Run deterministic audit
    const auditResult = auditService.runAuditForExperiment(experiment);

    return {
      experiment,
      audit: auditResult,
    };
  }

  getExperiment(id: UUID): Experiment | null {
    return experimentRepository.findById(id);
  }

  listExperiments(options: {
    limit: number;
    offset: number;
    status?: ExperimentStatus;
    search?: string;
  }) {
    return experimentRepository.list(options);
  }

  deleteExperiment(id: UUID): boolean {
    return experimentRepository.delete(id);
  }
}

export const experimentService = new ExperimentService();
