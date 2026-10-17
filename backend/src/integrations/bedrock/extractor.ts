import {
  ConverseCommand,
  BedrockRuntimeClient,
} from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient, bedrockModelId } from "./client.js";
import { config } from "../../config/env.js";
import {
  extractionSystemPrompt,
  buildExtractionPrompt,
} from "../../extraction/extraction-prompt.js";
import {
  ExperimentExtractionResult, SourceType,
  ExperimentExtractionSchema,
} from "../../extraction/experiment-schema.js";
import { normalizeExtractionResult } from "../../extraction/normalize.js";
import { BedrockIntegrationError } from "./bedrock-errors.js";

export interface ExperimentExtractor {
  extract(input: {
    transcript: string;
    sourceType: SourceType;
    sourceReference?: string | null;
  }): Promise<ExperimentExtractionResult>;
}

export class BedrockExtractor implements ExperimentExtractor {
  constructor(
    private client: BedrockRuntimeClient = bedrockClient,
    private modelId: string = bedrockModelId
  ) {}

  async extract(input: {
    transcript: string;
    sourceType: SourceType;
    sourceReference?: string | null;
  }): Promise<ExperimentExtractionResult> {
    if (!input.transcript || !input.transcript.trim()) {
      throw new BedrockIntegrationError("INVALID_INPUT", "Transcript cannot be empty", undefined, 400);
    }

    if (input.transcript.length > config.maxTranscriptCharacters) {
      throw new BedrockIntegrationError(
        "INPUT_TOO_LARGE",
        `Transcript exceeds maximum length of ${config.maxTranscriptCharacters} characters`,
        undefined,
        400
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.bedrockTimeoutMs);

    try {
      const command = new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: extractionSystemPrompt }],
        messages: [
          {
            role: "user",
            content: [{ text: buildExtractionPrompt(input.transcript) }],
          },
        ],
        inferenceConfig: {
          maxTokens: config.bedrockMaxTokens,
          temperature: config.bedrockTemperature,
        },
      });

      const response = await this.client.send(command, {
        abortSignal: controller.signal,
      });

      const textBlocks =
        response.output?.message?.content
          ?.filter((block): block is { text: string } => typeof block.text === "string")
          .map((block) => block.text) ?? [];

      const rawText = textBlocks.join("\n").trim();
      if (!rawText) {
        throw new BedrockIntegrationError(
          "EMPTY_RESPONSE",
          "Bedrock returned no usable text content",
          undefined,
          502
        );
      }

      // Strip markdown code fences if model wrapped in ```json ... ```
      const cleanedJson = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleanedJson);
      } catch {
        throw new BedrockIntegrationError(
          "MALFORMED_JSON",
          "Failed to parse model response as valid JSON",
          { rawPreview: rawText.slice(0, 300) },
          502
        );
      }

      const validationResult = ExperimentExtractionSchema.safeParse(parsed);
      if (!validationResult.success) {
        throw new BedrockIntegrationError(
          "SCHEMA_VALIDATION_ERROR",
          "Model response does not match the experiment extraction schema",
          { issues: validationResult.error.issues },
          422
        );
      }

      return normalizeExtractionResult(validationResult.data, {
        provider: "aws-bedrock",
        modelId: this.modelId,
      });
    } catch (err: any) {
      if (err.name === "AbortError" || controller.signal.aborted) {
        throw new BedrockIntegrationError(
          "TIMEOUT",
          `Bedrock invocation timed out after ${config.bedrockTimeoutMs}ms`,
          undefined,
          504
        );
      }
      if (err instanceof BedrockIntegrationError) {
        throw err;
      }
      throw BedrockIntegrationError.fromAwsError(err);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
