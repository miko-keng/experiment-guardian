import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { alexaSessionService } from "../services/alexa-session-service.js";
import { experimentService } from "../services/experiment-service.js";
import { auditService } from "../services/audit-service.js";
import { reportService } from "../services/report-service.js";
import { revisionService } from "../services/revision-service.js";
import { decisionRepository } from "../database/decision-repository.js";
import { assistantRepository } from "../database/assistant-repository.js";
import { findingInvestigationService } from "../services/finding-investigation-service.js";
import { editableExperimentFieldPaths } from "../revisions/revision-types.js";
import { getVerification } from "../services/verification-service.js";

const toolResult=(value:unknown)=>({content:[{type:"text" as const,text:JSON.stringify(value,null,2)}],structuredContent:value as Record<string,unknown>});
function buildServer(){
  const server=new McpServer({name:"experiment-guardian",version:"0.2.0"},{instructions:"Use Experiment Guardian to document research, run deterministic reproducibility audits, preserve rationale, and request explicit confirmation before applying revisions."});
  server.registerTool("start_experiment_session",{title:"Start experiment session",description:"Start a hands-free Alexa+ research documentation session, optionally linked to an imported source.",inputSchema:{title:z.string().max(160).optional(),experimentId:z.string().uuid().nullable().optional(),sourceId:z.string().uuid().nullable().optional()}},async(input)=>{const result=alexaSessionService.start(input);const activity=assistantRepository.startTool({sessionId:result.data.id,messageId:null,toolName:"start_experiment_session",toolInput:{transport:"streamable-http",arguments:input}});assistantRepository.finishTool(activity.id,{transport:"streamable-http",protocol:"MCP",status:"session_started"},activity.createdAt);assistantRepository.addEvent(result.data.id,"tool.completed",{toolName:"start_experiment_session",label:"MCP started research session",transport:"streamable-http"});return toolResult(result);});
  server.registerTool("add_experiment_observation",{title:"Add experiment observation",description:"Add a spoken or typed observation to the active experiment.",inputSchema:{sessionId:z.string().uuid(),text:z.string().min(1).max(50000),clientObservationId:z.string().min(1).max(200).optional()}},async(input)=>toolResult(await alexaSessionService.addObservation(input)));
  server.registerTool("get_active_experiment",{title:"Get active experiment",description:"Retrieve the session, active experiment context, messages, tools, and approvals.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.get(sessionId)));
  server.registerTool("ask_next_reproducibility_question",{title:"Ask next reproducibility question",description:"Select one proactive question from deterministic audit findings.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.nextQuestion(sessionId,true)));
  server.registerTool("confirm_experiment_action",{title:"Confirm experiment action",description:"Approve or reject the exact pending governed revision action.",inputSchema:{sessionId:z.string().uuid(),approvalRequestId:z.string().uuid(),decision:z.enum(["approve","reject"])}},async(input)=>toolResult(alexaSessionService.confirm(input)));
  server.registerTool("pause_experiment_session",{title:"Pause experiment session",description:"Pause while preserving active experiment context.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.pause(sessionId)));
  server.registerTool("resume_experiment_session",{title:"Resume experiment session",description:"Resume an exact paused session.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.resume(sessionId)));
  server.registerTool("finish_experiment_session",{title:"Finish experiment session",description:"Run the final audit and generate the reproducibility report.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.finish(sessionId)));
  server.registerTool("create_experiment_from_transcript",{title:"Create experiment from transcript",description:"Extract a structured experiment with the configured extractor and run the deterministic audit.",inputSchema:{transcript:z.string().min(1).max(50000),sourceType:z.enum(["manual","conversation","meeting_notes","browser_voice","audio_transcript","demo"]).optional(),sourceReference:z.string().max(500).optional()}},async(input)=>toolResult(await experimentService.createAndAudit(input)));
  server.registerTool("get_experiment",{title:"Get experiment",description:"Get the structured experiment, latest deterministic findings, and immutable finding history.",inputSchema:{experimentId:z.string().uuid()}},async({experimentId})=>toolResult({experiment:experimentService.getExperiment(experimentId),findings:auditService.getFindingsForExperiment(experimentId),findingHistory:auditService.getFindingHistory(experimentId),auditHistory:auditService.getAuditHistory(experimentId),verification:getVerification(experimentId)}));
  server.registerTool("get_experiment_verification",{title:"Get stored evidence and quality gate",description:"Read artifact metadata, claim verification states, and deterministic policy decision for an experiment.",inputSchema:{experimentId:z.string().uuid()}},async({experimentId})=>toolResult(getVerification(experimentId)));
  server.registerTool("list_experiments",{title:"List experiments",description:"List recent experiment records.",inputSchema:{limit:z.number().int().min(1).max(100).optional(),search:z.string().max(200).optional()}},async({limit,search})=>toolResult(experimentService.listExperiments({limit:limit||20,offset:0,search})));
  server.registerTool("audit_experiment",{title:"Audit experiment",description:"Run the deterministic reproducibility audit and persist an immutable run.",inputSchema:{experimentId:z.string().uuid()}},async({experimentId})=>{const experiment=experimentService.getExperiment(experimentId);if(!experiment)throw new Error("Experiment not found");return toolResult(auditService.runAuditForExperiment(experiment));});
  server.registerTool("generate_reproducibility_report",{title:"Generate reproducibility report",description:"Generate an evidence-linked Markdown or JSON report.",inputSchema:{experimentId:z.string().uuid(),format:z.enum(["markdown","json"]).optional()}},async({experimentId,format})=>toolResult(reportService.generate(experimentId,format||"markdown")));
  server.registerTool("propose_experiment_revision",{title:"Propose experiment correction",description:"Propose one structured experiment-field correction after the researcher supplies a value. This never edits the experiment directly; it creates an approval request that must be confirmed with confirm_experiment_action.",inputSchema:{sessionId:z.string().uuid().describe("Active Experiment Guardian session ID"),experimentId:z.string().uuid(),fieldPath:z.enum(editableExperimentFieldPaths).describe("Exact experiment field to correct"),proposedValue:z.unknown().describe("New value explicitly supplied or confirmed by the researcher"),reason:z.string().min(3).max(2000),evidenceText:z.string().max(4000).optional()}},async(input)=>{const session=assistantRepository.getSession(input.sessionId);if(!session||session.experimentId!==input.experimentId)throw new Error("The session is not linked to this experiment");const revision=revisionService.propose({experimentId:input.experimentId,fieldPath:input.fieldPath,proposedValue:input.proposedValue,reason:input.reason,proposedBy:"assistant",evidence:[{type:"transcript",experimentId:input.experimentId,fieldPath:input.fieldPath,description:"Value supplied through Alexa+",excerpt:input.evidenceText||input.reason,previousValue:null,currentValue:input.proposedValue,sourceReference:`alexa://session/${input.sessionId}`}]});const approval=assistantRepository.createApproval(input.sessionId,[revision.id],`${revision.fieldPath}: ${JSON.stringify(revision.previousValue)} to ${JSON.stringify(revision.proposedValue)}`);assistantRepository.addEvent(input.sessionId,"approval.required",{approvalRequestId:approval.id,revisionIds:[revision.id],label:"Alexa+ proposed a governed correction",summary:approval.summary});return toolResult({revision,approval,nextAction:"request_confirmation",message:"Ask the researcher to approve or reject this exact correction."});});
  server.registerTool("record_research_decision",{title:"Record research decision",description:"Preserve a researcher-confirmed choice and its rationale as evidence linked to an experiment.",inputSchema:{experimentId:z.string().uuid(),sessionId:z.string().uuid().optional(),statement:z.string().min(3).max(4000),state:z.enum(["proposed","confirmed","rejected","abandoned","superseded"]).optional(),owner:z.string().max(200).optional()}},async(input)=>toolResult(decisionRepository.create({experimentId:input.experimentId,state:input.state||"confirmed",statement:input.statement,owner:input.owner||null,sourceConversationId:input.sessionId||null,evidence:[{type:"transcript",experimentId:input.experimentId,fieldPath:null,description:"Decision supplied through Alexa+",excerpt:input.statement,previousValue:null,currentValue:input.statement,sourceReference:input.sessionId?`alexa://session/${input.sessionId}`:null}]})));
  server.registerTool("comment_on_audit_finding",{title:"Investigate audit finding comment",description:"Attach researcher context to an audit finding, investigate it in a linked Alexa+ session, and return a safe suggested correction or next question.",inputSchema:{findingId:z.string().uuid(),comment:z.string().min(3).max(4000)}},async({findingId,comment})=>toolResult(await findingInvestigationService.investigate(findingId,comment)));
  server.registerTool("continue_audit_finding_investigation",{title:"Continue audit finding investigation",description:"Continue the existing finding conversation. Explain stored evidence without mutation, or turn a researcher-supplied correction into a governed revision proposal.",inputSchema:{findingId:z.string().uuid(),sessionId:z.string().uuid(),message:z.string().min(1).max(4000)}},async({findingId,sessionId,message})=>toolResult(await findingInvestigationService.continue(findingId,sessionId,message)));
  server.registerTool("get_pending_experiment_action",{title:"Get pending approval",description:"Retrieve the exact pending governed action before asking the researcher to approve or reject it.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>{const session=assistantRepository.getSession(sessionId);if(!session)throw new Error("Session not found");const approval=session.pendingApprovalId?assistantRepository.getApproval(session.pendingApprovalId):null;return toolResult({sessionId,pending:approval,confirmationRequired:Boolean(approval)});});
  return server;
}

export async function handleMcpRequest(req:Request,res:Response){
  const rpc=req.body as any;
  const toolName=rpc?.method==="tools/call"?rpc?.params?.name:null;
  const toolArgs=rpc?.params?.arguments||{};
  const sessionId=typeof toolArgs.sessionId==="string"?toolArgs.sessionId:null;
  const knownSession=sessionId?assistantRepository.getSession(sessionId):null;
  const activity=toolName&&knownSession?assistantRepository.startTool({sessionId,messageId:null,toolName,toolInput:{transport:"streamable-http",arguments:toolArgs}}):null;
  if(activity){
    assistantRepository.addEvent(sessionId,"tool.started",{toolName,label:`MCP called ${toolName}`,transport:"streamable-http"});
    res.on("finish",()=>{
      if(res.statusCode>=400){
        assistantRepository.failTool(activity.id,`HTTP_${res.statusCode}`,activity.createdAt);
        assistantRepository.addEvent(sessionId,"tool.failed",{toolName,label:`MCP failed ${toolName}`,transport:"streamable-http"});
      }else{
        assistantRepository.finishTool(activity.id,{transport:"streamable-http",protocol:"MCP",status:"response_sent"},activity.createdAt);
        assistantRepository.addEvent(sessionId,"tool.completed",{toolName,label:`MCP completed ${toolName}`,transport:"streamable-http"});
      }
    });
  }
  const server=buildServer();
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined});
  res.on("close",()=>{void transport.close();void server.close();});
  await server.connect(transport);
  await transport.handleRequest(req,res,req.body);
}
