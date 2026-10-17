import crypto from "crypto";
import type { Database as DatabaseType } from "better-sqlite3";
import { db as defaultDb } from "./connection.js";
import type { BeeConversation, BeeUtterance } from "../integrations/bee/bee-types.js";

export interface StoredBeeConversation {
  id: string;
  providerId: string;
  title: string | null;
  startedAt: string | null;
  endedAt: string | null;
  lastSyncedAt: string | null;
  lastUtteranceTimestamp: number | null;
  contentHash: string | null;
  importStatus: "pending" | "syncing" | "ready" | "failed";
  errorMessage: string | null;
}

export class SqliteBeeRepository {
  constructor(private db: DatabaseType = defaultDb) {}

  upsertConversation(conversation: BeeConversation, status: StoredBeeConversation["importStatus"]): StoredBeeConversation {
    const existing = this.findByProviderId(conversation.id);
    const id = existing?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO bee_conversations (
        id, provider_id, title, started_at, ended_at, last_synced_at,
        last_utterance_timestamp, content_hash, import_status,
        error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT(provider_id) DO UPDATE SET
        title = excluded.title,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        import_status = excluded.import_status,
        error_message = NULL,
        updated_at = excluded.updated_at
    `).run(
      id,
      conversation.id,
      conversation.title,
      conversation.startedAt,
      conversation.endedAt,
      existing?.lastSyncedAt ?? null,
      existing?.lastUtteranceTimestamp ?? null,
      existing?.contentHash ?? null,
      status,
      now,
      now
    );
    return this.findByProviderId(conversation.id)!;
  }

  addUtterances(conversationId: string, utterances: BeeUtterance[]): number {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO bee_utterances (
        id, conversation_id, provider_utterance_id, speaker, spoken_at,
        spoken_at_epoch_ms, text, source_offset, content_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    return this.db.transaction((items: BeeUtterance[]) => {
      let added = 0;
      for (const utterance of items) {
        const contentHash = crypto.createHash("sha256").update(JSON.stringify({
          providerId: utterance.id,
          speaker: utterance.speaker,
          spokenAt: utterance.spokenAt,
          text: utterance.text,
        })).digest("hex");
        const result = insert.run(
          crypto.randomUUID(),
          conversationId,
          utterance.id,
          utterance.speaker,
          utterance.spokenAt,
          utterance.spokenAtEpochMs,
          utterance.text,
          utterance.sourceOffset,
          contentHash,
          now
        );
        added += result.changes;
      }
      return added;
    })(utterances);
  }

  finalizeSync(providerId: string, status: "ready" | "failed", errorMessage: string | null = null): StoredBeeConversation {
    const stored = this.findByProviderId(providerId);
    if (!stored) throw new Error("Bee conversation not stored");
    const utterances = this.listUtterances(stored.id);
    const transcript = this.formatTranscript(utterances);
    const contentHash = crypto.createHash("sha256").update(transcript).digest("hex");
    const latestTimestamp = utterances.reduce<number | null>((latest, item) => {
      if (item.spokenAtEpochMs === null) return latest;
      return latest === null ? item.spokenAtEpochMs : Math.max(latest, item.spokenAtEpochMs);
    }, null);
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE bee_conversations
      SET last_synced_at = ?, last_utterance_timestamp = ?, content_hash = ?,
          import_status = ?, error_message = ?, updated_at = ?
      WHERE provider_id = ?
    `).run(now, latestTimestamp, contentHash, status, errorMessage, now, providerId);
    return this.findByProviderId(providerId)!;
  }

  setStatus(providerId: string, status: StoredBeeConversation["importStatus"], errorMessage: string | null = null): void {
    this.db.prepare(`
      UPDATE bee_conversations
      SET import_status = ?, error_message = ?, updated_at = ?
      WHERE provider_id = ?
    `).run(status, errorMessage, new Date().toISOString(), providerId);
  }

  findByProviderId(providerId: string): StoredBeeConversation | null {
    const row = this.db.prepare("SELECT * FROM bee_conversations WHERE provider_id = ?").get(providerId) as any;
    return row ? this.mapConversation(row) : null;
  }

  listUtterances(conversationId: string): BeeUtterance[] {
    const rows = this.db.prepare(`
      SELECT * FROM bee_utterances
      WHERE conversation_id = ?
      ORDER BY COALESCE(spoken_at_epoch_ms, 0), COALESCE(source_offset, 0), created_at
    `).all(conversationId) as any[];
    return rows.map((row) => ({
      id: row.provider_utterance_id,
      speaker: row.speaker,
      spokenAt: row.spoken_at,
      spokenAtEpochMs: row.spoken_at_epoch_ms,
      text: row.text,
      sourceOffset: row.source_offset,
    }));
  }

  transcriptForProviderId(providerId: string): string {
    const conversation = this.findByProviderId(providerId);
    if (!conversation) return "";
    return this.formatTranscript(this.listUtterances(conversation.id));
  }

  private formatTranscript(utterances: BeeUtterance[]): string {
    return utterances.map((utterance) => {
      const time = utterance.spokenAt ? `[${utterance.spokenAt}] ` : "";
      const speaker = utterance.speaker ? `${utterance.speaker}: ` : "";
      return `${time}${speaker}${utterance.text}`;
    }).join("\n");
  }

  private mapConversation(row: any): StoredBeeConversation {
    return {
      id: row.id,
      providerId: row.provider_id,
      title: row.title,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      lastSyncedAt: row.last_synced_at,
      lastUtteranceTimestamp: row.last_utterance_timestamp,
      contentHash: row.content_hash,
      importStatus: row.import_status,
      errorMessage: row.error_message,
    };
  }
}

export const beeRepository = new SqliteBeeRepository();
