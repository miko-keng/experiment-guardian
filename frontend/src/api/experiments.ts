import { requestJson } from "./client";
import {
  CreateExperimentRequest,
  CreateExperimentResponse,
  ExperimentDetailResponse,
  HealthResponse,
  ListExperimentsResponse,
  AuditFinding,
  FindingStatus,
  ExperimentRevision,
  ResearchDecision,
  DecisionState,
  Experiment,
  AuditResult,
  AuditFindingComment,
} from "../types/index";

const BASE_URL = "/api/v1";

export async function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>(`${BASE_URL}/health`);
}

export async function createAndAuditExperiment(
  request: CreateExperimentRequest
): Promise<CreateExperimentResponse> {
  return requestJson<CreateExperimentResponse>(`${BASE_URL}/experiments/audit`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function listExperiments(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}): Promise<ListExperimentsResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set("limit", options.limit.toString());
  if (options?.offset !== undefined) params.set("offset", options.offset.toString());
  if (options?.status) params.set("status", options.status);
  if (options?.search) params.set("search", options.search);

  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson<ListExperimentsResponse>(`${BASE_URL}/experiments${query}`);
}

export async function getExperiment(id: string): Promise<ExperimentDetailResponse> {
  return requestJson<ExperimentDetailResponse>(`${BASE_URL}/experiments/${id}`);
}

export async function createLinkedReview(input: { mergeRequestUrl: string; runId: string; title?: string }) {
  return requestJson<{ experiment: Experiment }>(`${BASE_URL}/experiments/linked-review`, {
    method: "POST", body: JSON.stringify(input),
  });
}

export async function refreshLinkedEvidence(id: string, input: { mergeRequestUrl: string; runId: string }) {
  return requestJson(`${BASE_URL}/experiments/${id}/linked-evidence`, {
    method: "POST", body: JSON.stringify(input),
  });
}

export async function setExperimentPolicy(id: string): Promise<unknown> {
  return requestJson(`${BASE_URL}/experiments/${id}/policy`, {
    method: "PUT", body: JSON.stringify({ policyId: "ml-research" }),
  });
}

export async function addExperimentArtifact(id: string, input: {
  kind: string; uri: string | null; metadata: Record<string, unknown>;
}): Promise<unknown> {
  return requestJson(`${BASE_URL}/experiments/${id}/artifacts`, {
    method: "POST", body: JSON.stringify(input),
  });
}

export async function uploadExperimentArtifactFile(id: string, kind: string, file: File): Promise<unknown> {
  const body = new FormData();
  body.append("kind", kind); body.append("file", file);
  const response = await fetch(`${BASE_URL}/experiments/${id}/artifact-files`, { method: "POST", body });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message || "Could not upload artifact file");
  return result;
}

export async function updateFindingStatus(
  findingId: string,
  status: FindingStatus,
  resolutionNote?: string
): Promise<AuditFinding> {
  return requestJson<AuditFinding>(`${BASE_URL}/audits/${findingId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, resolutionNote }),
  });
}

export async function commentOnFinding(
  findingId: string,
  comment: string
): Promise<AuditFindingComment> {
  return requestJson<AuditFindingComment>(`${BASE_URL}/audits/${findingId}/comments`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function deleteExperiment(id: string): Promise<{ success: boolean; id: string }> {
  return requestJson<{ success: boolean; id: string }>(`${BASE_URL}/experiments/${id}`, {
    method: "DELETE",
  });
}

export async function proposeRevision(
  experimentId: string,
  input: { fieldPath: string; proposedValue: unknown; reason: string }
): Promise<ExperimentRevision> {
  return requestJson<ExperimentRevision>(`${BASE_URL}/experiments/${experimentId}/revisions`, {
    method: "POST",
    body: JSON.stringify({ ...input, proposedBy: "user", evidence: [] }),
  });
}

export async function reviewRevision(
  experimentId: string,
  revisionId: string,
  action: "apply" | "reject"
): Promise<ExperimentRevision | { revision: ExperimentRevision; experiment: Experiment; audit: AuditResult }> {
  return requestJson(`${BASE_URL}/experiments/${experimentId}/revisions/${revisionId}/${action}`, {
    method: "POST",
  });
}

export async function createDecision(
  experimentId: string,
  input: { statement: string; owner?: string | null; state?: DecisionState }
): Promise<ResearchDecision> {
  return requestJson<ResearchDecision>(`${BASE_URL}/experiments/${experimentId}/decisions`, {
    method: "POST",
    body: JSON.stringify({ ...input, evidence: [] }),
  });
}

export async function updateDecisionState(
  experimentId: string,
  decisionId: string,
  state: DecisionState
): Promise<ResearchDecision> {
  return requestJson<ResearchDecision>(`${BASE_URL}/experiments/${experimentId}/decisions/${decisionId}`, {
    method: "PATCH",
    body: JSON.stringify({ state }),
  });
}
