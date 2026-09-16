import { mkdir,readFile,writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { query } from "./db";

function root(){
  const dir=process.env.AQUA_UPLOAD_DIR;
  if(!dir)throw Object.assign(new Error("AQUA_UPLOAD_DIR is not configured for durable media storage."),{status:503});
  return path.resolve(dir);
}

function extension(mime:string){
  if(mime==="image/jpeg")return ".jpg";
  if(mime==="image/png")return ".png";
  if(mime==="image/webp")return ".webp";
  if(mime==="image/heic"||mime==="image/heif")return ".heic";
  return ".bin";
}

export async function saveMedia(input:{workspace:string;tankId:string;livestockId?:string;kind?:string;file:File}){
  const allowed=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
  if(!allowed.has(input.file.type))throw Object.assign(new Error("Unsupported media type."),{status:415});
  const max=Number(process.env.AQUA_UPLOAD_MAX_MB||12)*1024*1024;
  if(input.file.size>max)throw Object.assign(new Error("Image exceeds the configured upload limit."),{status:413});
  const id=randomUUID(),dir=root();
  await mkdir(dir,{recursive:true});
  const fileName=`${id}${extension(input.file.type)}`;
  const full=path.join(dir,fileName);
  const bytes=Buffer.from(await input.file.arrayBuffer());
  await writeFile(full,bytes);
  await query("INSERT INTO aqua_media_assets(id,workspace_key,tank_id,livestock_id,kind,storage_path,mime_type,size_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[
    id,input.workspace,input.tankId,input.livestockId||null,input.kind||"photo",fileName,input.file.type,bytes.length
  ]);
  return {id,tankId:input.tankId,livestockId:input.livestockId,kind:input.kind||"photo",mimeType:input.file.type,sizeBytes:bytes.length,url:`/api/media/${id}`};
}

export async function loadMedia(workspace:string,id:string){
  const result=await query<{storage_path:string;mime_type:string;size_bytes:string|number}>("SELECT storage_path,mime_type,size_bytes FROM aqua_media_assets WHERE workspace_key=$1 AND id=$2",[workspace,id]);
  const row=result.rows[0];
  if(!row)return null;
  const full=path.join(root(),path.basename(row.storage_path));
  const data=await readFile(full);
  return {data,mimeType:row.mime_type,sizeBytes:Number(row.size_bytes)};
}
