export interface BeeConnectionStatus {
  enabled: boolean;
  installed: boolean;
  authenticated: boolean;
  provider: "cli";
  version: string | null;
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

export interface BeeProvider {
  getConnectionStatus(): Promise<BeeConnectionStatus>;
  listConversations(input?: { cursor?: string; limit?: number }): Promise<{
    items: BeeConversationSummary[];
    nextCursor: string | null;
  }>;
  getConversation(id: string): Promise<BeeConversation>;
  getTranscriptSince(id: string, since?: number): Promise<BeeUtterance[]>;
  findRelatedConversations(id: string, limit?: number): Promise<BeeConversationSummary[]>;
}
