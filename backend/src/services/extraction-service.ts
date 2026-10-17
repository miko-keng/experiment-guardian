import { config } from "../config/env.js";
import { BedrockExtractor, ExperimentExtractor } from "../integrations/bedrock/extractor.js";
import { MockExtractor } from "../integrations/bedrock/mock-extractor.js";
import { ExperimentExtractionResult, SourceType } from "../extraction/experiment-schema.js";

export interface TranscriptInput {
  transcript: string;
  sourceType: SourceType;
  sourceId?: string | null;
  sourceReference?: string | null;
}

export class ExtractionService {
  private extractor: ExperimentExtractor;

  constructor(customExtractor?: ExperimentExtractor) {
    if (customExtractor) {
      this.extractor = customExtractor;
    } else if (config.allowMockAi) {
      console.log("[ExtractionService] ALLOW_MOCK_AI=true -> using MockExtractor");
      this.extractor = new MockExtractor();
    } else {
      console.log(`[ExtractionService] Initializing live BedrockExtractor with model: ${config.bedrockModelId} in region: ${config.awsRegion}`);
      this.extractor = new BedrockExtractor();
    }
  }

  setExtractor(extractor: ExperimentExtractor): void {
    this.extractor = extractor;
  }

  async extract(input: TranscriptInput): Promise<ExperimentExtractionResult> {
    return this.extractor.extract({
      transcript: input.transcript,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference,
    });
  }
}

export const extractionService = new ExtractionService();
