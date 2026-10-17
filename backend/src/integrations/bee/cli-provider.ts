import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../../config/env.js";
import { BedrockIntegrationError } from "../bedrock/bedrock-errors.js";
import type {
  BeeConnectionStatus,
  BeeConversation,
  BeeConversationSummary,
  BeeProvider,
  BeeUtterance,
} from "./bee-types.js";

const execFileAsync = promisify(execFile);
const safeIdentifier = /^[A-Za-z0-9._:-]+$/;

function requireIdentifier(value: string, label: string): string {
  if (!safeIdentifier.test(value) || value.length > 500) {
    throw new BedrockIntegrationError("INVALID_BEE_IDENTIFIER", `Invalid ${label}`, undefined, 400);
  }
  return value;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function epochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function collection(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key];
  }
  if (record.data) return collection(record.data, keys);
  return [];
}

function normalizeSummary(value: unknown): BeeConversationSummary {
  const item = asRecord(value);
  const id = asString(item.id ?? item.conversation_id ?? item.conversationId);
  if (!id) {
    throw new BedrockIntegrationError(
      "BEE_RESPONSE_INVALID",
      "Bee returned a conversation without an identifier",
      undefined,
      502
    );
  }
  return {
    id,
    title: asString(item.title ?? item.name ?? item.headline),
    startedAt: asString(item.started_at ?? item.start_time ?? item.startedAt),
    endedAt: asString(item.ended_at ?? item.end_time ?? item.endedAt),
    state: asString(item.state ?? item.status),
    summary: asString(item.summary ?? item.description),
  };
}

function normalizeUtterance(value: unknown, index: number): BeeUtterance {
  if (typeof value === "string") {
    return { id: null, speaker: null, spokenAt: null, spokenAtEpochMs: null, text: value, sourceOffset: index };
  }
  const item = asRecord(value);
  const text = asString(item.text ?? item.content ?? item.transcript);
  if (!text) {
    throw new BedrockIntegrationError(
      "BEE_RESPONSE_INVALID",
      "Bee returned a transcript utterance without text",
      undefined,
      502
    );
  }
  const spokenAt = asString(item.spoken_at ?? item.timestamp ?? item.start_time ?? item.spokenAt);
  return {
    id: asString(item.id ?? item.utterance_id ?? item.utteranceId),
    speaker: asString(item.speaker ?? item.speaker_name ?? item.participant),
    spokenAt,
    spokenAtEpochMs: epochMs(item.spoken_at_epoch_ms ?? item.timestamp_ms ?? item.timestamp ?? spokenAt),
    text,
    sourceOffset: typeof item.source_offset === "number" ? item.source_offset : index,
  };
}

export class BeeCliProvider implements BeeProvider {
  async getConnectionStatus(): Promise<BeeConnectionStatus> {
    if (!config.beeEnabled) {
      return {
        enabled: false,
        installed: false,
        authenticated: false,
        provider: "cli",
        version: null,
        message: "Bee integration is disabled. Manual transcript entry remains available.",
      };
    }

    try {
      const versionResult = await this.run(["version", "--json"]);
      const versionPayload = asRecord(versionResult);
      const version = asString(versionPayload.version) ?? "installed";
      try {
        await this.run(["status"]);
        return { enabled: true, installed: true, authenticated: true, provider: "cli", version, message: "Bee CLI is installed and authenticated." };
      } catch (error) {
        return { enabled: true, installed: true, authenticated: false, provider: "cli", version, message: "Bee CLI is installed. Run bee login to authenticate." };
      }
    } catch (error: any) {
      if (error?.code === "ENOENT" || error?.cause?.code === "ENOENT") {
        return { enabled: true, installed: false, authenticated: false, provider: "cli", version: null, message: "Bee CLI is not installed." };
      }
      return { enabled: true, installed: false, authenticated: false, provider: "cli", version: null, message: "Bee CLI could not be started." };
    }
  }

  async listConversations(input: { cursor?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const args = ["conversations", "list", "--limit", String(limit), "--json"];
    if (input.cursor) args.push("--cursor", requireIdentifier(input.cursor, "cursor"));
    const payload = await this.runJson(args);
    const record = asRecord(payload);
    return {
      items: collection(payload, ["items", "conversations"]).map(normalizeSummary),
      nextCursor: asString(record.next_cursor ?? record.nextCursor ?? asRecord(record.pagination).next_cursor),
    };
  }

  async getConversation(id: string): Promise<BeeConversation> {
    const safeId = requireIdentifier(id, "conversation id");
    const payload = await this.runJson(["conversations", "get", safeId, "--json"]);
    const record = asRecord(payload);
    const summary = normalizeSummary(record.conversation ?? record);
    const utterances = collection(record, ["utterances", "transcript", "items"])
      .map(normalizeUtterance);
    return { ...summary, utterances };
  }

  async getTranscriptSince(id: string, since?: number): Promise<BeeUtterance[]> {
    const args = ["conversations", "transcript", requireIdentifier(id, "conversation id")];
    if (since !== undefined) {
      if (!Number.isSafeInteger(since) || since < 0) {
        throw new BedrockIntegrationError("INVALID_BEE_TIMESTAMP", "Invalid Bee transcript timestamp", undefined, 400);
      }
      args.push("--since", String(since));
    }
    args.push("--json");
    const payload = await this.runJson(args);
    return collection(payload, ["utterances", "transcript", "items"]).map(normalizeUtterance);
  }

  async findRelatedConversations(id: string, limit = 10): Promise<BeeConversationSummary[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const payload = await this.runJson([
      "conversations", "related", requireIdentifier(id, "conversation id"),
      "--limit", String(safeLimit), "--json",
    ]);
    return collection(payload, ["items", "conversations", "related"]).map(normalizeSummary);
  }

  private async runJson(args: string[]): Promise<unknown> {
    const value = await this.run(args);
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      throw new BedrockIntegrationError(
        "BEE_RESPONSE_INVALID",
        "Bee CLI returned invalid JSON",
        undefined,
        502
      );
    }
  }

  private async run(args: string[]): Promise<unknown> {
    try {
      const { stdout } = await execFileAsync(config.beeCliPath, args, {
        timeout: config.beeCliTimeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      });
      return stdout.trim();
    } catch (error: any) {
      if (error?.code === "ENOENT") throw error;
      if (error?.killed || error?.signal === "SIGTERM") {
        throw new BedrockIntegrationError("BEE_TIMEOUT", "Bee CLI request timed out", undefined, 504);
      }
      const message = String(error?.stderr || error?.message || "Bee CLI request failed");
      const authRequired = /login|authenticated|authentication|unauthorized/i.test(message);
      throw new BedrockIntegrationError(
        authRequired ? "BEE_AUTH_REQUIRED" : "BEE_CLI_ERROR",
        authRequired ? "Bee authentication is required. Run bee login." : "Bee CLI request failed.",
        undefined,
        authRequired ? 401 : 502
      );
    }
  }
}

export const beeProvider = new BeeCliProvider();
