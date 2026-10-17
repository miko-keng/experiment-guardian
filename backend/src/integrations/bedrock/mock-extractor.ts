import { ExperimentExtractor } from "./extractor.js";
import { ExperimentExtractionResult, SourceType } from "../../extraction/experiment-schema.js";
import { normalizeExtractionResult } from "../../extraction/normalize.js";

/**
 * Deterministic mock extractor used for unit tests and local UI development
 * when ALLOW_MOCK_AI=true. Does not hallucinate or call external APIs.
 */
export class MockExtractor implements ExperimentExtractor {
  async extract(input: {
    transcript: string;
    sourceType: SourceType;
    sourceReference?: string | null;
  }): Promise<ExperimentExtractionResult> {
    const text = input.transcript.toLowerCase();

    // Check for learning rate
    let learningRate: number | null = null;
    const lrMatch = input.transcript.match(/learning[\s-_]?rate(?: of| is|:)?\s*([0-9.]+)/i);
    if (lrMatch) {
      learningRate = parseFloat(lrMatch[1]);
    }

    // Check for batch size
    let batchSize: number | null = null;
    const bsMatch = input.transcript.match(/batch[\s-_]?size(?: of| is|:)?\s*([0-9]+)/i);
    if (bsMatch) {
      batchSize = parseInt(bsMatch[1], 10);
    }

    // Check for epochs
    let epochs: number | null = null;
    const epMatch = input.transcript.match(/([0-9]+)\s*epochs/i);
    if (epMatch) {
      epochs = parseInt(epMatch[1], 10);
    }

    // Check for random seed
    let randomSeed: number | null = null;
    const seedMatch = input.transcript.match(/(?:random[\s-_]?seed|seed)(?: of| is|:)?\s*([0-9]+)/i);
    if (seedMatch) {
      randomSeed = parseInt(seedMatch[1], 10);
    }

    // Check for model name
    let modelName: string | null = null;
    if (text.includes("llama-3") || text.includes("llama 3")) {
      modelName = "LLaMA-3-8B";
    } else if (text.includes("resnet")) {
      modelName = "ResNet-50";
    } else if (text.includes("bert")) {
      modelName = "BERT-Base";
    } else if (text.includes("model a")) {
      modelName = "Model A";
    }

    // Check for dataset
    let datasetName: string | null = null;
    let datasetVersion: string | null = null;
    if (text.includes("imagenet")) {
      datasetName = "ImageNet";
    } else if (text.includes("glue") || text.includes("sst2")) {
      datasetName = "GLUE-SST2";
    }

    const dsVerMatch = input.transcript.match(/dataset\s*v(?:ersion)?\s*([0-9.]+)/i);
    if (dsVerMatch) {
      datasetVersion = `v${dsVerMatch[1]}`;
    }

    // Check for dataset splits
    let trainSplit: string | null = null;
    let testSplit: string | null = null;
    const splitMatch = input.transcript.match(/([0-9]+)\/([0-9]+)\s*(?:split|data split)/i);
    if (splitMatch) {
      trainSplit = `${splitMatch[1]}%`;
      testSplit = `${splitMatch[2]}%`;
    }

    // Check for ambiguities
    const ambiguities = [];
    if (text.includes("not decided") || text.includes("maybe") || text.includes("or whether")) {
      ambiguities.push({
        fieldPath: "dataset.trainSplit",
        description: "Researcher mentioned potential data split changes without confirmation",
        evidence: [input.transcript],
        clarificationQuestion: "Was the data split confirmed or still undecided?",
      });
    }

    // Title inference
    let title = "Experiment Run";
    if (text.includes("baseline")) {
      title = "Baseline experiment";
    } else if (modelName) {
      title = `${modelName} Evaluation`;
    }

    const result = {
      experiment: {
        title,
        hypothesis: null,
        objective: null,
        model: {
          architecture: modelName ? "Transformer / Neural Net" : null,
          modelName,
          modelVersion: null,
          parameters: {},
        },
        dataset: {
          datasetName,
          datasetVersion,
          datasetIdentifier: null,
          trainSplit,
          validationSplit: null,
          testSplit,
          preprocessing: {},
        },
        training: {
          learningRate,
          batchSize,
          epochs,
          optimizer: text.includes("adam") ? "AdamW" : null,
          randomSeed,
          framework: text.includes("pytorch") ? "PyTorch" : null,
          frameworkVersion: null,
          environment: {},
          otherParameters: {},
        },
        evaluation: {
          metrics: {},
          evaluationProcedure: null,
          evaluationDatasetIdentifier: null,
          codeCommit: null,
          notes: null,
        },
        baselineExperimentId: null,
        source: {
          sourceType: input.sourceType,
          sourceId: null,
          sourceReference: input.sourceReference || null,
          transcriptHash: null,
          sourceTimestamp: null,
        },
      },
      extractedFields: {
        ...(learningRate !== null ? { "training.learningRate": [{ sourceType: input.sourceType, quotedEvidence: lrMatch![0] }] } : {}),
        ...(randomSeed !== null ? { "training.randomSeed": [{ sourceType: input.sourceType, quotedEvidence: seedMatch![0] }] } : {}),
      },
      ambiguities,
    };

    return normalizeExtractionResult(result, {
      provider: "mock",
      modelId: "mock-extractor-v1",
    });
  }
}
