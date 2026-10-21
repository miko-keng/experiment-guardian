import crypto from "crypto";
import { db as defaultDb, type DatabaseType } from "./connection.js";
import type { AssistantMessage, AssistantSession, AssistantSessionStatus, ApprovalRequest, SessionEvent, ToolInvocation } from "../services/assistant-types.js";

const json = (value: string | null) => { try { return value ? JSON.parse(value) : null; } catch { return null; } };

export class AssistantRepository {
  constructor(private database: DatabaseType = defaultDb) {}

  createSession(input: { title?: string; experimentId?: string | null; sourceId?: string | null }): AssistantSession {
    const now = new Date().toISOString();
    const item: AssistantSession = { id: crypto.randomUUID(), experimentId: input.experimentId || null, sourceId: input.sourceId || null, title: input.title?.trim() || "New research session", status: "active", unresolvedFindingId: null, pendingApprovalId: null, lastToolName: null, createdAt: now, updatedAt: now };
    this.database.prepare(`INSERT INTO assistant_sessions (id, experiment_id, source_id, title, status, unresolved_finding_id, pending_approval_id, last_tool_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(item.id, item.experimentId, item.sourceId, item.title, item.status, null, null, null, now, now);
    return item;
  }

  getSession(id: string): AssistantSession | null {
    const r = this.database.prepare(`SELECT * FROM assistant_sessions WHERE id = ?`).get(id) as any;
    return r ? this.mapSession(r) : null;
  }

  listSessions(limit = 20): AssistantSession[] {
    return (this.database.prepare(`SELECT * FROM assistant_sessions ORDER BY updated_at DESC LIMIT ?`).all(limit) as any[]).map((r) => this.mapSession(r));
  }

  updateSession(id: string, patch: Partial<Pick<AssistantSession, "experimentId" | "sourceId" | "title" | "status" | "unresolvedFindingId" | "pendingApprovalId" | "lastToolName">>): AssistantSession | null {
    const current = this.getSession(id); if (!current) return null;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.database.prepare(`UPDATE assistant_sessions SET experiment_id=?, source_id=?, title=?, status=?, unresolved_finding_id=?, pending_approval_id=?, last_tool_name=?, updated_at=? WHERE id=?`).run(next.experimentId, next.sourceId, next.title, next.status, next.unresolvedFindingId, next.pendingApprovalId, next.lastToolName, next.updatedAt, id);
    return next;
  }

  addMessage(input: { sessionId: string; role: "user" | "assistant"; content: string; clientMessageId?: string | null; modelId?: string | null; linkedExperimentId?: string | null }): AssistantMessage {
    if (input.clientMessageId) {
      const existing = this.database.prepare(`SELECT * FROM assistant_messages WHERE session_id=? AND client_message_id=?`).get(input.sessionId, input.clientMessageId) as any;
      if (existing) return this.mapMessage(existing);
    }
    const item: AssistantMessage = { id: crypto.randomUUID(), sessionId: input.sessionId, role: input.role, content: input.content, clientMessageId: input.clientMessageId || null, modelId: input.modelId || null, linkedExperimentId: input.linkedExperimentId || null, createdAt: new Date().toISOString() };
    this.database.prepare(`INSERT INTO assistant_messages (id, session_id, role, content, client_message_id, model_id, linked_experiment_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(item.id, item.sessionId, item.role, item.content, item.clientMessageId, item.modelId, item.linkedExperimentId, item.createdAt);
    return item;
  }

  listMessages(sessionId: string): AssistantMessage[] {
    return (this.database.prepare(`SELECT * FROM assistant_messages WHERE session_id=? ORDER BY created_at, rowid`).all(sessionId) as any[]).map((r) => this.mapMessage(r));
  }

  addObservation(input: { sessionId: string; clientObservationId: string; text: string; observedAt?: string }): { id: string; duplicate: boolean } {
    const existing = this.database.prepare(`SELECT id FROM session_observations WHERE session_id=? AND client_observation_id=?`).get(input.sessionId, input.clientObservationId) as any;
    if (existing) return { id: existing.id, duplicate: true };
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    this.database.prepare(`INSERT INTO session_observations (id, session_id, client_observation_id, text, observed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(id, input.sessionId, input.clientObservationId, input.text, input.observedAt || now, now);
    return { id, duplicate: false };
  }

  observationTranscript(sessionId: string): string {
    const rows = this.database.prepare(`SELECT text FROM session_observations WHERE session_id=? ORDER BY observed_at, rowid`).all(sessionId) as Array<{text:string}>;
    return rows.map((r) => r.text).join("\n");
  }

  startTool(input: { sessionId?: string | null; messageId?: string | null; toolName: string; toolInput: unknown }): ToolInvocation {
    const item: ToolInvocation = { id: crypto.randomUUID(), sessionId: input.sessionId || null, messageId: input.messageId || null, toolName: input.toolName, input: input.toolInput, output: null, status: "running", durationMs: null, errorCode: null, createdAt: new Date().toISOString(), completedAt: null };
    this.database.prepare(`INSERT INTO tool_invocations (id, session_id, message_id, tool_name, input_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(item.id, item.sessionId, item.messageId, item.toolName, JSON.stringify(item.input), item.status, item.createdAt);
    return item;
  }

  finishTool(id: string, output: unknown, startedAt: string): void {
    const completedAt = new Date().toISOString(); const duration = Math.max(0, Date.now() - Date.parse(startedAt));
    this.database.prepare(`UPDATE tool_invocations SET output_json=?, status='completed', duration_ms=?, completed_at=? WHERE id=?`).run(JSON.stringify(output), duration, completedAt, id);
  }

  failTool(id: string, errorCode: string, startedAt: string): void {
    this.database.prepare(`UPDATE tool_invocations SET status='failed', error_code=?, duration_ms=?, completed_at=? WHERE id=?`).run(errorCode, Math.max(0, Date.now() - Date.parse(startedAt)), new Date().toISOString(), id);
  }

  listTools(sessionId: string): ToolInvocation[] {
    return (this.database.prepare(`SELECT * FROM tool_invocations WHERE session_id=? ORDER BY created_at, rowid`).all(sessionId) as any[]).map((r) => ({ id:r.id, sessionId:r.session_id, messageId:r.message_id, toolName:r.tool_name, input:json(r.input_json), output:json(r.output_json), status:r.status, durationMs:r.duration_ms, errorCode:r.error_code, createdAt:r.created_at, completedAt:r.completed_at }));
  }

  createApproval(sessionId: string, revisionIds: string[], summary: string): ApprovalRequest {
    const now = new Date(); const item: ApprovalRequest = { id: crypto.randomUUID(), sessionId, revisionIds, summary, status:"pending", requestedAt:now.toISOString(), expiresAt:new Date(now.getTime()+10*60*1000).toISOString(), resolvedAt:null, resolvedBy:null };
    this.database.prepare(`INSERT INTO approval_requests (id, session_id, revision_ids_json, summary, status, expires_at, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(item.id, sessionId, JSON.stringify(revisionIds), summary, item.status, item.expiresAt, item.requestedAt);
    this.updateSession(sessionId, { pendingApprovalId:item.id, status:"waiting_for_confirmation" }); return item;
  }

  getApproval(id: string): ApprovalRequest | null {
    const r = this.database.prepare(`SELECT * FROM approval_requests WHERE id=?`).get(id) as any;
    return r ? { id:r.id, sessionId:r.session_id, revisionIds:json(r.revision_ids_json)||[], summary:r.summary, status:r.status, expiresAt:r.expires_at, requestedAt:r.requested_at, resolvedAt:r.resolved_at, resolvedBy:r.resolved_by } : null;
  }

  resolveApproval(id: string, status: "approved"|"rejected", actor: string): ApprovalRequest | null {
    const now = new Date().toISOString();
    this.database.prepare(`UPDATE approval_requests SET status=?, resolved_at=?, resolved_by=? WHERE id=? AND status='pending'`).run(status, now, actor, id);
    const approval = this.getApproval(id); if (approval) this.updateSession(approval.sessionId,{pendingApprovalId:null,status:"active"}); return approval;
  }

  listApprovals(sessionId: string): ApprovalRequest[] {
    return (this.database.prepare(`SELECT id FROM approval_requests WHERE session_id=? ORDER BY requested_at DESC`).all(sessionId) as any[]).map((r)=>this.getApproval(r.id)!).filter(Boolean);
  }

  addEvent(sessionId: string, type: string, payload: Record<string, unknown> = {}): SessionEvent {
    const item = { id:crypto.randomUUID(), sessionId, type, payload, createdAt:new Date().toISOString() };
    const result = this.database.prepare(`INSERT INTO session_events (id, session_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)`).run(item.id, sessionId, type, JSON.stringify(payload), item.createdAt);
    return { ...item, sequence:Number(result.lastInsertRowid) };
  }

  listEvents(sessionId: string, afterSequence = 0): SessionEvent[] {
    return (this.database.prepare(`SELECT * FROM session_events WHERE session_id=? AND sequence>? ORDER BY sequence`).all(sessionId, afterSequence) as any[]).map((r)=>({sequence:r.sequence,id:r.id,sessionId:r.session_id,type:r.event_type,payload:json(r.payload_json)||{},createdAt:r.created_at}));
  }

  listImportedSources(experimentId: string): Array<{ sourceId: string; edited: boolean }> {
    const rows = this.database.prepare(`SELECT events.payload_json FROM session_events AS events
      JOIN assistant_sessions AS sessions ON sessions.id = events.session_id
      WHERE sessions.experiment_id = ? AND events.event_type = 'source.observed'
      ORDER BY events.sequence`).all(experimentId) as Array<{ payload_json: string }>;
    return rows.map((row) => json(row.payload_json))
      .filter((payload): payload is { sourceId: string; edited: boolean } => typeof payload?.sourceId === "string")
      .map((payload) => ({ sourceId: payload.sourceId, edited: Boolean(payload.edited) }));
  }

  private mapSession(r:any): AssistantSession { return {id:r.id,experimentId:r.experiment_id,sourceId:r.source_id,title:r.title,status:r.status as AssistantSessionStatus,unresolvedFindingId:r.unresolved_finding_id,pendingApprovalId:r.pending_approval_id,lastToolName:r.last_tool_name,createdAt:r.created_at,updatedAt:r.updated_at}; }
  private mapMessage(r:any): AssistantMessage { return {id:r.id,sessionId:r.session_id,role:r.role,content:r.content,clientMessageId:r.client_message_id,modelId:r.model_id,linkedExperimentId:r.linked_experiment_id,createdAt:r.created_at}; }
}

export const assistantRepository = new AssistantRepository();
