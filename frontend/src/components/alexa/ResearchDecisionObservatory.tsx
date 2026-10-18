import React, { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import type { AlexaSession, ToolInvocation } from "../../api/alexa";

type FlowStep = { from: string; to: string; label: string };
const positions: Record<string, [number, number]> = { alexa:[300,46], mcp:[300,153], bedrock:[92,136], audit:[508,136], revision:[168,265], database:[432,265] };
const nodes = [
  {id:"alexa",label:"Alexa+",tag:"SIMULATOR",tone:"cyan"},
  {id:"mcp",label:"MCP Server",tag:"REAL",tone:"violet"},
  {id:"bedrock",label:"Bedrock Extractor",tag:"MOCK",tone:"pink"},
  {id:"audit",label:"Audit Engine",tag:"DETERMINISTIC",tone:"amber"},
  {id:"revision",label:"Revision Engine",tag:"GOVERNED",tone:"emerald"},
  {id:"database",label:"Database",tag:"REAL",tone:"blue"},
];

function eventSteps(event: any): FlowStep[] {
  const label=event.payload?.label||event.type;
  if(event.type==="tool.started")return[{from:"alexa",to:"mcp",label}];
  if(event.type==="extraction.started")return[{from:"mcp",to:"bedrock",label}];
  if(event.type==="extraction.completed")return[{from:"bedrock",to:"mcp",label}];
  if(event.type==="revision.proposed"||event.type==="revision.started")return[{from:"mcp",to:"revision",label}];
  if(event.type==="database.write")return[{from:event.payload?.operation?.startsWith("revision")?"revision":"mcp",to:"database",label}];
  if(event.type==="audit.completed")return[{from:"database",to:"audit",label},{from:"audit",to:"database",label:"Audit findings stored"}];
  if(event.type==="approval.required")return[{from:"revision",to:"mcp",label}];
  if(event.type==="tool.completed")return[{from:"mcp",to:"alexa",label}];
  return [];
}

export const ResearchDecisionObservatory: React.FC<{session:AlexaSession;tools:ToolInvocation[];events:any[]}>=({session,tools,events})=>{
  const steps=useMemo(()=>events.flatMap(eventSteps),[events]);
  const [flowIndex,setFlowIndex]=useState(0);
  useEffect(()=>{if(!steps.length)return;setFlowIndex(0);const timer=window.setInterval(()=>setFlowIndex(index=>{if(index>=steps.length-1){window.clearInterval(timer);return index;}return index+1;}),850);return()=>window.clearInterval(timer);},[events.length,steps.length]);
  const current=steps[flowIndex];
  const latest=[...tools].reverse().find(tool=>tool.status==="running")||tools[tools.length-1];
  return <section className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-[#07182e] to-cyan-950/30 p-5 overflow-hidden">
    <div className="flex justify-between"><div><p className="text-xs uppercase tracking-wider text-cyan-300 font-bold">Research Decision Observatory</p><h2 className="font-bold mt-1">Event-driven execution map</h2><p className="text-[10px] text-slate-500 mt-1">Alexa+ and Bedrock are simulated · MCP, audits, revisions, and database operations are functional</p></div><Activity className="w-6 h-6 text-cyan-300 observatory-beacon"/></div>
    <div className="observatory-scene observatory-scene-six mt-3" aria-label="Event-driven system activity map"><div className="observatory-grid"/><div className="observatory-core"/>
      <svg className="observatory-links" viewBox="0 0 600 320" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="active-flow" x1="0" x2="1"><stop stopColor="#67e8f9"/><stop offset=".5" stopColor="#fff"/><stop offset="1" stopColor="#a78bfa"/></linearGradient><filter id="flow-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#a5f3fc"/></marker></defs>{current&&<><line className="event-flow-line" x1={positions[current.from][0]} y1={positions[current.from][1]} x2={positions[current.to][0]} y2={positions[current.to][1]} markerEnd="url(#flow-arrow)"/><circle className="event-flow-packet" r="6" fill="#fff" filter="url(#flow-glow)"><animateMotion dur=".8s" repeatCount="indefinite" path={`M${positions[current.from][0]} ${positions[current.from][1]} L${positions[current.to][0]} ${positions[current.to][1]}`}/></circle></>}</svg>
      {nodes.map(node=><SystemNode key={node.id} className={`observatory-node-${node.id} node-${node.tone}`} label={node.label} tag={node.tag} active={current?.from===node.id||current?.to===node.id}/>)}
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-300"><span className={`h-2 w-2 rounded-full ${current?"bg-cyan-300 animate-pulse":"bg-slate-600"}`}/>{current?current.label:latest?`${latest.toolName.replace(/_/g," ")} · ${latest.status}`:session.experimentId?"Idle · experiment context retained":"Waiting for a research observation"}</div>
  </section>;
};

const SystemNode=({label,tag,active,className}:{label:string;tag:string;active:boolean;className:string})=><div className={`observatory-node observatory-node-six ${className} ${active?"is-active":"is-idle"}`}><span className="observatory-node-ring"/><span className="relative z-10 flex flex-col"><span>{label}</span><span className="mt-1 text-[8px] tracking-[.18em] opacity-60">{tag}</span></span></div>;
