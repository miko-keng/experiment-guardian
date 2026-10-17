import { Router } from "express";
import { config } from "../config/env.js";
export const capabilitiesRouter=Router();
capabilitiesRouter.get("/",(_req,res)=>res.json({mcp:{ready:true,transport:"streamable-http",endpoint:"/mcp"},bedrock:{configured:Boolean(config.awsBearerTokenBedrock)||config.allowMockAi,mockMode:config.allowMockAi,modelId:config.bedrockModelId},voice:{browserSpeech:true,recordedAudio:config.transcribeEnabled&&Boolean(config.transcribeInputBucket),provider:config.transcribeEnabled?"amazon-transcribe":null},documents:{types:[".txt",".md",".pdf",".docx"],maxBytes:10485760},bee:{enabled:config.beeEnabled,optional:true},alexa:{simulation:true,voiceFirst:true}}));
