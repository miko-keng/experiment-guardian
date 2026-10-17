import { requestJson } from "./client";
import type { CreateExperimentResponse, ExperimentRevision } from "../types/index";

const BASE_URL = "/api/v1/bee";

export interface BeeStatus {
  enabled: boolean;
  installed: boolean;
  authenticated: boolean;
  configured: boolean;
  provider: "cli";
  version: string | null;
  status: "ready" | "authentication_required" | "not_configured";
  message: string;
}

export interface BeeConversationSummary {
  id: string;
  title: string | null;
  startedAt: string | null;
  endedAt: string | null;
  state: string | null;
  summary: string | null;
}

export interface BeeUtterance {
  id: string | null;
  speaker: string | null;
  spokenAt: string | null;
  spokenAtEpochMs: number | null;
  text: string;
  sourceOffset: number | null;
}

export interface BeeConversation extends BeeConversationSummary {
  utterances: BeeUtterance[];
}

export function getBeeStatus(): Promise<BeeStatus> {
  return requestJson<BeeStatus>(`${BASE_URL}/status`);
}

export function listBeeConversations(cursor?: string): Promise<{
  items: BeeConversationSummary[];
  nextCursor: string | null;
}> {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  return requestJson(`${BASE_URL}/conversations?${params}`);
}

export function getBeeConversation(id: string): Promise<BeeConversation> {
  return requestJson<BeeConversation>(`${BASE_URL}/conversations/${encodeURIComponent(id)}`);
}

export function getRelatedBeeConversations(id: string): Promise<{ items: BeeConversationSummary[] }> {
  return requestJson(`${BASE_URL}/conversations/${encodeURIComponent(id)}/related?limit=6`);
}

export function importBeeConversation(id: string): Promise<CreateExperimentResponse> {
  return requestJson<CreateExperimentResponse>(`${BASE_URL}/conversations/${encodeURIComponent(id)}/import`, {
    method: "POST",
  });
}

export function syncBeeConversation(id: string): Promise<{
  newUtterances: number;
  changed: boolean;
  proposals: ExperimentRevision[];
}> {
  return requestJson(`${BASE_URL}/conversations/${encodeURIComponent(id)}/sync`, {
    method: "POST",
  });
}
