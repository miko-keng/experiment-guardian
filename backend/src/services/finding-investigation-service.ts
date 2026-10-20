import { auditRepository } from "../database/audit-repository.js";
import { alexaSessionService } from "./alexa-session-service.js";
import { BedrockIntegrationError } from "../integrations/bedrock/bedrock-errors.js";
import { assistantRepository } from "../database/assistant-repository.js";

export class FindingInvestigationService {
  async investigate(findingId: string, comment: string) {
    const finding = auditRepository.findById(findingId);
    if (!finding) throw new BedrockIntegrationError("NOT_FOUND", "Audit finding not found", undefined, 404);

    const started = alexaSessionService.start({
      title: `Investigation: ${finding.title}`,
      experimentId: finding.experimentId,
    });
    assistantRepository.addEvent(started.data.id, "tool.started", { toolName: "comment_on_audit_finding", label: "Alexa+ Simulator called MCP finding investigation" });
    assistantRepository.addMessage({ sessionId: started.data.id, role: "user", content: comment,
      linkedExperimentId: finding.experimentId });
    const speech = `I checked "${finding.title}" against its stored evidence. ${finding.description} ${finding.recommendation} I have not changed the experiment.`;
    assistantRepository.addMessage({ sessionId: started.data.id, role: "assistant", content: speech,
      linkedExperimentId: finding.experimentId });
    assistantRepository.updateSession(started.data.id, { unresolvedFindingId: finding.id });

    const saved = auditRepository.createComment({
      findingId: finding.id,
      experimentId: finding.experimentId,
      sessionId: started.data.id,
      comment,
      analysis: {
        suggestion: finding.recommendation,
        speech,
        nextAction: "listen",
        visual: { view: "audit", experimentId: finding.experimentId, findingId: finding.id },
        data: { findingId: finding.id, ruleId: finding.ruleId, modified: false },
      },
    });
    assistantRepository.addEvent(started.data.id, "database.write", { operation: "finding.comment", experimentId: finding.experimentId, label: "Investigation context stored" });
    assistantRepository.addEvent(started.data.id, "tool.completed", { toolName: "comment_on_audit_finding", label: "MCP finding investigation completed" });
    return saved;
  }

  async continue(findingId: string, sessionId: string, message: string) {
    const finding = auditRepository.findById(findingId);
    if (!finding) throw new BedrockIntegrationError("NOT_FOUND", "Audit finding not found", undefined, 404);
    const session = assistantRepository.getSession(sessionId);
    if (!session || session.experimentId !== finding.experimentId) {
      throw new BedrockIntegrationError("INVESTIGATION_CONTEXT_MISMATCH", "This chat is not linked to the selected finding", undefined, 409);
    }
    const text = message.trim();
    if (!text) throw new BedrockIntegrationError("INVALID_INPUT", "Message cannot be empty", undefined, 400);

    if (/^(?:why|why\?|explain|show (?:me )?the evidence|what evidence)/i.test(text)) {
      assistantRepository.addMessage({ sessionId, role: "user", content: text, linkedExperimentId: finding.experimentId });
      const evidence = finding.evidence.length
        ? finding.evidence.map((item) => `${item.fieldPath || item.type}: ${item.description}${item.currentValue == null ? " (not recorded)" : ` (recorded as ${JSON.stringify(item.currentValue)})`}`).join("; ")
        : "The audit rule found no supporting experiment evidence.";
      const explanation = `This recommendation comes from deterministic rule ${finding.ruleId}. ${finding.description} Evidence: ${evidence} Recommendation: ${finding.recommendation} I have not changed the experiment.`;
      assistantRepository.addMessage({ sessionId, role: "assistant", content: explanation, linkedExperimentId: finding.experimentId });
      assistantRepository.addEvent(sessionId, "finding.explained", { findingId, ruleId: finding.ruleId, label: "Finding explained from stored evidence", readOnly: true });
      return { data: { findingId, evidence: finding.evidence, modified: false }, speech: { text: explanation, shouldListen: true, confirmationRequired: false }, visual: { view: "audit", experimentId: finding.experimentId, findingId }, nextAction: "listen" };
    }

    if (session.pendingApprovalId) {
      alexaSessionService.confirm({ sessionId, approvalRequestId: session.pendingApprovalId, decision: "reject", actor: "researcher-correction" });
    }
    const response = await alexaSessionService.addObservation({ sessionId, text, clientObservationId: `finding-${findingId}-${Date.now()}` });
    assistantRepository.updateSession(sessionId, { unresolvedFindingId: finding.id });
    return response;
  }
}

export const findingInvestigationService = new FindingInvestigationService();
