import { requestJson } from "./client";
export type SessionStatus="active"|"processing"|"waiting_for_answer"|"waiting_for_confirmation"|"paused"|"completed"|"failed";
export interface AlexaSession{id:string;experimentId:string|null;sourceId:string|null;title:string;status:SessionStatus;unresolvedFindingId:string|null;pendingApprovalId:string|null;lastToolName:string|null;createdAt:string;updatedAt:string}
export interface Message{id:string;role:"user"|"assistant";content:string;createdAt:string}
export interface ToolInvocation{id:string;toolName:string;status:"running"|"completed"|"failed";durationMs:number|null;createdAt:string;errorCode:string|null;output:any}
export interface Approval{id:string;summary:string;status:"pending"|"approved"|"rejected"|"expired";expiresAt:string;revisionIds:string[]}
export interface SessionDetail{session:AlexaSession;messages:Message[];tools:ToolInvocation[];approvals:Approval[];events:any[]}
export interface Envelope<T=any>{data:T;speech:{text:string;shouldListen:boolean;confirmationRequired:boolean};visual:{view:string;experimentId?:string;findingId?:string;approvalRequestId?:string;reportId?:string};nextAction:string}
export const startSession=(input:{title?:string;experimentId?:string|null;sourceId?:string|null}={})=>requestJson<Envelope<AlexaSession>>("/api/v1/alexa/sessions/start",{method:"POST",body:JSON.stringify(input)});
export const getSession=(id:string)=>requestJson<SessionDetail>(`/api/v1/alexa/sessions/${id}`);
export const listSessions=()=>requestJson<{items:AlexaSession[]}>("/api/v1/alexa/sessions");
export const addObservation=(id:string,text:string,clientObservationId=crypto.randomUUID())=>requestJson<Envelope>(`/api/v1/alexa/sessions/${id}/observations`,{method:"POST",body:JSON.stringify({text,clientObservationId})});
export const confirmAction=(sessionId:string,approvalRequestId:string,decision:"approve"|"reject")=>requestJson<Envelope>(`/api/v1/alexa/sessions/${sessionId}/confirm`,{method:"POST",body:JSON.stringify({approvalRequestId,decision})});
export const pauseSession=(id:string)=>requestJson<Envelope>(`/api/v1/alexa/sessions/${id}/pause`,{method:"POST"});
export const resumeSession=(id:string)=>requestJson<Envelope>(`/api/v1/alexa/sessions/${id}/resume`,{method:"POST"});
export const finishSession=(id:string)=>requestJson<Envelope>(`/api/v1/alexa/sessions/${id}/finish`,{method:"POST"});
export interface DemoScenario{id:string;title:string;description:string;databaseBacked?:boolean;linkedOnly?:boolean;judgePrompt?:string;judgeAnswer?:string;judgeExpected?:string}
export const listDemoScenarios=()=>requestJson<{items:DemoScenario[]}>("/api/v1/sources/demo");
export const loadDemoSource=(id:string)=>requestJson<any>(`/api/v1/sources/demo/${id}`,{method:"POST"});
export const loadDatabaseDemo=(id:string)=>requestJson<any>(`/api/v1/sources/demo/${id}/load`,{method:"POST"});
export async function uploadSource(file:File){const body=new FormData();body.append("file",file);const audio=/\.(mp3|mp4|wav|flac|m4a|webm|ogg)$/i.test(file.name);const res=await fetch(audio?"/api/v1/sources/audio":"/api/v1/sources/files",{method:"POST",body});if(!res.ok){const data=await res.json().catch(()=>null);throw new Error(data?.error?.message||"Could not extract this file");}return res.json();}
export const getReport=(id:string)=>requestJson<any>(`/api/v1/reports/${id}`);
