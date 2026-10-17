import { Router } from "express";
import { reportRepository } from "../database/report-repository.js";
export const reportsRouter=Router();
reportsRouter.get("/:id",(req,res)=>{const item=reportRepository.findById(String(req.params.id));if(!item){res.status(404).json({error:{code:"NOT_FOUND",message:"Report not found"}});return;}res.json(item);});
