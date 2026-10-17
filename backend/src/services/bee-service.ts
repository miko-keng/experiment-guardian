import { beeProvider } from "../integrations/bee/cli-provider.js";
import { beeRepository } from "../database/bee-repository.js";
import { experimentRepository } from "../database/experiment-repository.js";
import { experimentService } from "./experiment-service.js";
import { extractionService } from "./extraction-service.js";
import { revisionService } from "./revision-service.js";
import { BedrockIntegrationError } from "../integrations/bedrock/bedrock-errors.js";
import type { BeeConversation, BeeUtterance } from "../integrations/bee/bee-types.js";
import type { Experiment } from "../extraction/experiment-schema.js";
import type { EditableExperimentFieldPath } from "../revisions/revision-types.js";

const comparableFields: EditableExperimentFieldPath[] = [
  "model.architecture", "model.modelName", "model.modelVersion",
  "dataset.datasetName", "dataset.datasetVersion", "dataset.datasetIdentifier",
  "dataset.trainSplit", "dataset.validationSplit", "dataset.testSplit",
  "training.learningRate", "training.batchSize", "training.epochs",
  "training.optimizer", "training.randomSeed", "training.framework", "training.frameworkVersion",
  "evaluation.evaluationProcedure", "evaluation.evaluationDatasetIdentifier",
  "evaluation.codeCommit", "evaluation.notes",
];

function fieldValue(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
}

function transcriptFrom(utterances: BeeUtterance[]): string {
  return utterances.map((item) => `${item.speaker ? `${item.speaker}: ` : ""}${item.text}`).join("\n");
}

export class BeeService {
  getStatus() {
    return beeProvider.getConnectionStatus();
  }

  listConversations(cursor?: string, limit?: number) {
    return beeProvider.listConversations({ cursor, limit });
  }

  async getConversation(id: string): Promise<BeeConversation> {
    const conversation = await beeProvider.getConversation(id);
    if (conversation.utterances.length === 0) {
      conversation.utterances = await beeProvider.getTranscriptSince(id);
    }
    return conversation;
  }

  getRelated(id: string, limit?: number) {
    return beeProvider.findRelatedConversations(id, limit);
  }

  async importConversation(id: string) {
    const existingExperiment = experimentRepository.findBySourceId(id);
    if (existingExperiment) {
      throw new BedrockIntegrationError(
        "BEE_ALREADY_IMPORTED",
        "This Bee conversation has already been imported.",
        { experimentId: existingExperiment.id },
        409
      );
    }

    const conversation = await this.getConversation(id);
    if (conversation.utterances.length === 0) {
      throw new BedrockIntegrationError("BEE_TRANSCRIPT_EMPTY", "Bee conversation has no transcript utterances.", undefined, 422);
    }
    const stored = beeRepository.upsertConversation(conversation, "syncing");
    beeRepository.addUtterances(stored.id, conversation.utterances);
    const transcript = beeRepository.transcriptForProviderId(id);

    try {
      const result = await experimentService.createAndAudit({
        transcript,
        sourceType: "bee",
        sourceId: id,
        sourceReference: `bee://conversation/${id}`,
      });
      beeRepository.finalizeSync(id, "ready");
      return { ...result, sourceConversation: beeRepository.findByProviderId(id) };
    } catch (error: any) {
      beeRepository.finalizeSync(id, "failed", error?.message || "Import failed");
      throw error;
    }
  }

  async syncConversation(id: string) {
    const stored = beeRepository.findByProviderId(id);
    if (!stored) {
      throw new BedrockIntegrationError("BEE_NOT_IMPORTED", "Import this Bee conversation before synchronizing it.", undefined, 404);
    }
    beeRepository.setStatus(id, "syncing");
    try {
      const utterances = await beeProvider.getTranscriptSince(id, stored.lastUtteranceTimestamp ?? undefined);
      const added = beeRepository.addUtterances(stored.id, utterances);
      const updated = beeRepository.finalizeSync(id, "ready");
      const proposals = added > 0 ? await this.proposeChanges(id, utterances) : [];
      return { conversation: updated, newUtterances: added, changed: added > 0, proposals };
    } catch (error: any) {
      beeRepository.setStatus(id, "failed", error?.message || "Synchronization failed");
      throw error;
    }
  }

  private async proposeChanges(sourceId: string, newUtterances: BeeUtterance[]) {
    const experiment = experimentRepository.findBySourceId(sourceId);
    if (!experiment) return [];
    const transcript = beeRepository.transcriptForProviderId(sourceId);
    const extraction = await extractionService.extract({
      transcript,
      sourceType: "bee",
      sourceId,
      sourceReference: `bee://conversation/${sourceId}`,
    });
    const candidate = extraction.experiment as Experiment;
    const existingProposals = revisionService.list(experiment.id);
    const excerpt = transcriptFrom(newUtterances).slice(0, 1000);
    const proposals = [];
    for (const path of comparableFields) {
      const current = fieldValue(experiment, path);
      const proposed = fieldValue(candidate, path);
      if (proposed === null || proposed === undefined || Object.is(current, proposed)) continue;
      const duplicate = existingProposals.some((revision) =>
        revision.status === "proposed" && revision.fieldPath === path &&
        JSON.stringify(revision.proposedValue) === JSON.stringify(proposed)
      );
      if (duplicate) continue;
      proposals.push(revisionService.propose({
        experimentId: experiment.id,
        fieldPath: path,
        proposedValue: proposed,
        reason: "Detected from newly synchronized Bee conversation context.",
        proposedBy: "assistant",
        evidence: [{
          type: "transcript",
          experimentId: experiment.id,
          fieldPath: path,
          description: "New Bee transcript context",
          excerpt: excerpt || null,
          previousValue: current,
          currentValue: proposed,
          sourceReference: `bee://conversation/${sourceId}`,
        }],
      }));
    }
    return proposals;
  }
}

export const beeService = new BeeService();
