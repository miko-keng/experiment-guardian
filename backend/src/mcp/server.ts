import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { Request, Response } from "express";
import { alexaSessionService } from "../services/alexa-session-service.js";
import { experimentService } from "../services/experiment-service.js";
import { auditService } from "../services/audit-service.js";
import { reportService } from "../services/report-service.js";

const toolResult=(value:unknown)=>({content:[{type:"text" as const,text:JSON.stringify(value,null,2)}],structuredContent:value as Record<string,unknown>});
function buildServer(){
  const server=new McpServer({name:"experiment-guardian",version:"0.2.0"},{instructions:"Use Experiment Guardian to document research, run deterministic reproducibility audits, preserve rationale, and request explicit confirmation before applying revisions."});
  server.registerTool("start_experiment_session",{title:"Start experiment session",description:"Start a hands-free Alexa+ research documentation session.",inputSchema:{title:z.string().max(160).optional(),experimentId:z.string().uuid().optional()}},async(input)=>toolResult(alexaSessionService.start(input)));
  server.registerTool("add_experiment_observation",{title:"Add experiment observation",description:"Add a spoken or typed observation to the active experiment.",inputSchema:{sessionId:z.string().uuid(),text:z.string().min(1).max(50000),clientObservationId:z.string().min(1).max(200).optional()}},async(input)=>toolResult(await alexaSessionService.addObservation(input)));
  server.registerTool("get_active_experiment",{title:"Get active experiment",description:"Retrieve the session, active experiment context, messages, tools, and approvals.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.get(sessionId)));
  server.registerTool("ask_next_reproducibility_question",{title:"Ask next reproducibility question",description:"Select one proactive question from deterministic audit findings.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.nextQuestion(sessionId)));
  server.registerTool("confirm_experiment_action",{title:"Confirm experiment action",description:"Approve or reject the exact pending governed revision action.",inputSchema:{sessionId:z.string().uuid(),approvalRequestId:z.string().uuid(),decision:z.enum(["approve","reject"])}},async(input)=>toolResult(alexaSessionService.confirm(input)));
  server.registerTool("pause_experiment_session",{title:"Pause experiment session",description:"Pause while preserving active experiment context.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.pause(sessionId)));
  server.registerTool("resume_experiment_session",{title:"Resume experiment session",description:"Resume an exact paused session.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.resume(sessionId)));
  server.registerTool("finish_experiment_session",{title:"Finish experiment session",description:"Run the final audit and generate the reproducibility report.",inputSchema:{sessionId:z.string().uuid()}},async({sessionId})=>toolResult(alexaSessionService.finish(sessionId)));
  server.registerTool("create_experiment_from_transcript",{title:"Create experiment from transcript",description:"Extract a structured experiment with the configured extractor and run the deterministic audit.",inputSchema:{transcript:z.string().min(1).max(50000),sourceType:z.enum(["manual","conversation","meeting_notes","browser_voice","audio_transcript","demo"]).optional(),sourceReference:z.string().max(500).optional()}},async(input)=>toolResult(await experimentService.createAndAudit(input)));
  server.registerTool("get_experiment",{title:"Get experiment",description:"Get structured experiment and latest deterministic findings.",inputSchema:{experimentId:z.string().uuid()}},async({experimentId})=>toolResult({experiment:experimentService.getExperiment(experimentId),findings:auditService.getFindingsForExperiment(experimentId),auditHistory:auditService.getAuditHistory(experimentId)}));
  server.registerTool("list_experiments",{title:"List experiments",description:"List recent experiment records.",inputSchema:{limit:z.number().int().min(1).max(100).optional(),search:z.string().max(200).optional()}},async({limit,search})=>toolResult(experimentService.listExperiments({limit:limit||20,offset:0,search})));
  server.registerTool("audit_experiment",{title:"Audit experiment",description:"Run the deterministic reproducibility audit and persist an immutable run.",inputSchema:{experimentId:z.string().uuid()}},async({experimentId})=>{const experiment=experimentService.getExperiment(experimentId);if(!experiment)throw new Error("Experiment not found");return toolResult(auditService.runAuditForExperiment(experiment));});
  server.registerTool("generate_reproducibility_report",{title:"Generate reproducibility report",description:"Generate an evidence-linked Markdown or JSON report.",inputSchema:{experimentId:z.string().uuid(),format:z.enum(["markdown","json"]).optional()}},async({experimentId,format})=>toolResult(reportService.generate(experimentId,format||"markdown")));
  return server;
}

export async function handleMcpRequest(req:Request,res:Response){
  const server=buildServer();
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined});
  res.on("close",()=>{void transport.close();void server.close();});
  await server.connect(transport);
  await transport.handleRequest(req,res,req.body);
}
