import { z } from "zod";
import type { AuditEvidence } from "../audit/audit-types.js";
import type { UUID } from "../extraction/experiment-schema.js";

export const decisionStates = [
  "proposed",
  "confirmed",
  "rejected",
  "abandoned",
  "superseded",
] as const;

export type DecisionState = typeof decisionStates[number];

export const CreateDecisionSchema = z.object({
  state: z.enum(decisionStates).default("proposed"),
  statement: z.string().trim().min(3).max(4000),
  owner: z.string().trim().max(200).nullable().optional().default(null),
  sourceConversationId: z.string().trim().max(500).nullable().optional().default(null),
  evidence: z.array(z.unknown()).default([]),
});

export const UpdateDecisionSchema = z.object({
  state: z.enum(decisionStates),
});

export interface ResearchDecision {
  id: UUID;
  experimentId: UUID | null;
  state: DecisionState;
  statement: string;
  owner: string | null;
  sourceConversationId: string | null;
  evidence: AuditEvidence[];
  createdAt: string;
  updatedAt: string;
}
