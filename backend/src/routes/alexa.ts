import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { alexaSessionService } from "../services/alexa-session-service.js";
import { assistantRepository } from "../database/assistant-repository.js";

export const alexaRouter=Router();
const Start=z.object({title:z.string().max(160).optional(),experimentId:z.string().uuid().nullable().optional(),sourceId:z.string().uuid().nullable().optional()});
const Observation=z.object({text:z.string().min(1).max(50000),clientObservationId:z.string().min(1).max(200).optional(),observedAt:z.string().optional()});

alexaRouter.get("/sessions",(_req,res)=>res.json({items:alexaSessionService.list()}));
alexaRouter.post("/sessions/start",(req,res,next)=>{try{res.status(201).json(alexaSessionService.start(Start.parse(req.body)));}catch(e){next(e);}});
alexaRouter.get("/sessions/:id",(req,res,next)=>{try{res.json(alexaSessionService.get(String(req.params.id)));}catch(e){next(e);}});
alexaRouter.post("/sessions/:id/observations",async(req,res,next)=>{try{res.json(await alexaSessionService.addObservation({...Observation.parse(req.body),sessionId:String(req.params.id)}));}catch(e){next(e);}});
alexaRouter.post("/sessions/:id/next-question",(req,res,next)=>{try{res.json(alexaSessionService.nextQuestion(String(req.params.id),true));}catch(e){next(e);}});
alexaRouter.post("/sessions/:id/pause",(req,res,next)=>{try{res.json(alexaSessionService.pause(String(req.params.id)));}catch(e){next(e);}});
alexaRouter.post("/sessions/:id/resume",(req,res,next)=>{try{res.json(alexaSessionService.resume(String(req.params.id)));}catch(e){next(e);}});
alexaRouter.post("/sessions/:id/finish",(req,res,next)=>{try{res.json(alexaSessionService.finish(String(req.params.id)));}catch(e){next(e);}});
alexaRouter.post("/sessions/:id/confirm",(req,res,next)=>{try{const input=z.object({approvalRequestId:z.string().uuid(),decision:z.enum(["approve","reject"])}).parse(req.body);res.json(alexaSessionService.confirm({sessionId:String(req.params.id),...input}));}catch(e){next(e);}});
alexaRouter.get("/sessions/:id/events",(req:Request,res:Response,next:NextFunction)=>{try{const sessionId=String(req.params.id);alexaSessionService.get(sessionId);res.setHeader("Content-Type","text/event-stream");res.setHeader("Cache-Control","no-cache");res.setHeader("Connection","keep-alive");res.flushHeaders();let cursor=Number(req.headers["last-event-id"]||req.query.after||0);const send=()=>{for(const event of assistantRepository.listEvents(sessionId,cursor)){cursor=event.sequence;res.write(`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);}};send();const timer=setInterval(send,750);const keepalive=setInterval(()=>res.write(": keepalive\n\n"),15000);req.on("close",()=>{clearInterval(timer);clearInterval(keepalive);});}catch(e){next(e);}});
