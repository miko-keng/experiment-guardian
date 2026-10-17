export type AssistantSessionStatus =
  | "active"
  | "processing"
  | "waiting_for_answer"
  | "waiting_for_confirmation"
  | "paused"
  | "completed"
  | "failed";

export interface AssistantSession {
  id: string;
  experimentId: string | null;
  sourceId: string | null;
  title: string;
  status: AssistantSessionStatus;
  unresolvedFindingId: string | null;
  pendingApprovalId: string | null;
  lastToolName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  clientMessageId: string | null;
  modelId: string | null;
  linkedExperimentId: string | null;
  createdAt: string;
}

export interface ToolInvocation {
  id: string;
  sessionId: string | null;
  messageId: string | null;
  toolName: string;
  input: unknown;
  output: unknown;
  status: "running" | "completed" | "failed";
  durationMs: number | null;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  revisionIds: string[];
  summary: string;
  status: "pending" | "approved" | "rejected" | "expired";
  expiresAt: string;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface SessionEvent {
  sequence: number;
  id: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AlexaToolEnvelope<T> {
  data: T;
  speech: { text: string; shouldListen: boolean; confirmationRequired: boolean };
  visual: {
    view: "session" | "experiment" | "audit" | "approval" | "report";
    experimentId?: string;
    findingId?: string;
    approvalRequestId?: string;
    reportId?: string;
    highlight?: string[];
  };
  nextAction: "listen" | "ask_follow_up" | "request_confirmation" | "show_report" | "none";
}
