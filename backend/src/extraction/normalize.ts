import { ExperimentExtractionResult } from "./experiment-schema.js";

/**
 * Normalizes validated AI output ensuring clean defaults,
 * consistent null handling, and metadata tracking without inventing data.
 */
export function normalizeExtractionResult(
  data: any,
  meta: { provider: "aws-bedrock" | "mock"; modelId: string }
): ExperimentExtractionResult {
  const exp = data.experiment || {};

  return {
    experiment: {
      title: exp.title?.trim() || "Untitled Experiment",
      hypothesis: exp.hypothesis?.trim() || null,
      objective: exp.objective?.trim() || null,
      model: {
        architecture: exp.model?.architecture?.trim() || null,
        modelName: exp.model?.modelName?.trim() || null,
        modelVersion: exp.model?.modelVersion?.trim() || null,
        parameters: exp.model?.parameters && typeof exp.model.parameters === "object" ? exp.model.parameters : {},
      },
      dataset: {
        datasetName: exp.dataset?.datasetName?.trim() || null,
        datasetVersion: exp.dataset?.datasetVersion?.trim() || null,
        datasetIdentifier: exp.dataset?.datasetIdentifier?.trim() || null,
        trainSplit: exp.dataset?.trainSplit?.trim() || null,
        validationSplit: exp.dataset?.validationSplit?.trim() || null,
        testSplit: exp.dataset?.testSplit?.trim() || null,
        preprocessing: exp.dataset?.preprocessing && typeof exp.dataset.preprocessing === "object" ? exp.dataset.preprocessing : {},
      },
      training: {
        learningRate: typeof exp.training?.learningRate === "number" ? exp.training.learningRate : null,
        batchSize: typeof exp.training?.batchSize === "number" ? exp.training.batchSize : null,
        epochs: typeof exp.training?.epochs === "number" ? exp.training.epochs : null,
        optimizer: exp.training?.optimizer?.trim() || null,
        randomSeed: typeof exp.training?.randomSeed === "number" ? exp.training.randomSeed : null,
        framework: exp.training?.framework?.trim() || null,
        frameworkVersion: exp.training?.frameworkVersion?.trim() || null,
        environment: exp.training?.environment && typeof exp.training.environment === "object" ? exp.training.environment : {},
        otherParameters: exp.training?.otherParameters && typeof exp.training.otherParameters === "object" ? exp.training.otherParameters : {},
      },
      evaluation: {
        metrics: exp.evaluation?.metrics && typeof exp.evaluation.metrics === "object" ? exp.evaluation.metrics : {},
        evaluationProcedure: exp.evaluation?.evaluationProcedure?.trim() || null,
        evaluationDatasetIdentifier: exp.evaluation?.evaluationDatasetIdentifier?.trim() || null,
        codeCommit: exp.evaluation?.codeCommit?.trim() || null,
        notes: exp.evaluation?.notes?.trim() || null,
      },
      baselineExperimentId: exp.baselineExperimentId || null,
      source: exp.source || {
        sourceType: "manual",
        sourceId: null,
        sourceReference: null,
        transcriptHash: null,
        sourceTimestamp: null,
      },
      extractedAt: new Date().toISOString(),
    },
    extractedFields: data.extractedFields || {},
    ambiguities: Array.isArray(data.ambiguities) ? data.ambiguities : [],
    extractionMetadata: {
      provider: meta.provider,
      modelId: meta.modelId,
      extractedAt: new Date().toISOString(),
    },
  };
}
