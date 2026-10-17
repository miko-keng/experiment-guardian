import crypto from "crypto";
import { db as defaultDb, type DatabaseType } from "./connection.js";

export interface SourceArtifact { id:string; sourceType:string; originalName:string|null; mediaType:string|null; contentHash:string; extractedText:string|null; metadata:Record<string,unknown>; createdAt:string; }
export class SourceRepository {
  constructor(private database:DatabaseType=defaultDb){}
  create(input:{sourceType:string;originalName?:string|null;mediaType?:string|null;text:string;metadata?:Record<string,unknown>}):SourceArtifact{
    const item:SourceArtifact={id:crypto.randomUUID(),sourceType:input.sourceType,originalName:input.originalName||null,mediaType:input.mediaType||null,contentHash:crypto.createHash("sha256").update(input.text).digest("hex"),extractedText:input.text,metadata:input.metadata||{},createdAt:new Date().toISOString()};
    this.database.prepare(`INSERT INTO source_artifacts (id,source_type,original_name,media_type,content_hash,extracted_text,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).run(item.id,item.sourceType,item.originalName,item.mediaType,item.contentHash,item.extractedText,JSON.stringify(item.metadata),item.createdAt); return item;
  }
  findById(id:string):SourceArtifact|null{const r=this.database.prepare(`SELECT * FROM source_artifacts WHERE id=?`).get(id) as any; return r?{id:r.id,sourceType:r.source_type,originalName:r.original_name,mediaType:r.media_type,contentHash:r.content_hash,extractedText:r.extracted_text,metadata:JSON.parse(r.metadata_json||"{}"),createdAt:r.created_at}:null;}
}
export const sourceRepository=new SourceRepository();
