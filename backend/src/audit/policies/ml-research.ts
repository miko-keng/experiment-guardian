import type { ArtifactKind } from "../../database/artifact-repository.js";

export const mlResearchPolicy = {
  id: "ml-research",
  version: "1.0.0",
  requiredArtifacts: ["run_manifest", "dataset_manifest", "training_config", "evaluation_script", "evaluation_result", "model_checkpoint", "dependency_lock"] as ArtifactKind[],
  blockOnSeverity: "critical" as const,
  overrideRequiresAuthenticatedReviewer: true,
};
