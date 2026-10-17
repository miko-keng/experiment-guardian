import { auditRepository } from "../database/audit-repository.js";
import { alexaSessionService } from "./alexa-session-service.js";
import { BedrockIntegrationError } from "../integrations/bedrock/bedrock-errors.js";

export class FindingInvestigationService {
  async investigate(findingId: string, comment: string) {
    const finding = auditRepository.findById(findingId);
    if (!finding) throw new BedrockIntegrationError("NOT_FOUND", "Audit finding not found", undefined, 404);

    const started = alexaSessionService.start({
      title: `Investigation: ${finding.title}`,
      experimentId: finding.experimentId,
    });
    const investigation = await alexaSessionService.addObservation({
      sessionId: started.data.id,
      text: `Researcher comment on audit finding "${finding.title}": ${comment}`,
    });
    const suggestion = investigation.nextAction === "request_confirmation"
      ? investigation.speech.text
      : `${finding.recommendation} ${investigation.speech.text}`;

    return auditRepository.createComment({
      findingId: finding.id,
      experimentId: finding.experimentId,
      sessionId: started.data.id,
      comment,
      analysis: {
        suggestion,
        speech: investigation.speech.text,
        nextAction: investigation.nextAction,
        visual: investigation.visual,
        data: investigation.data,
      },
    });
  }
}

export const findingInvestigationService = new FindingInvestigationService();
