import { mkdir,readFile,unlink,writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { query } from "./db";
import { ensureWorkspace } from "./workspace";

function root(){
  const dir=process.env.AQUA_UPLOAD_DIR;
  if(!dir)throw Object.assign(new Error("AQUA_UPLOAD_DIR is not configured for durable media storage."),{status:503});
  return path.resolve(dir);
}


function magicMatches(bytes:Buffer,mime:string){
  if(mime==="image/jpeg")return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(mime==="image/png")return bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if(mime==="image/webp")return bytes.length>=12&&bytes.subarray(0,4).toString("ascii")==="RIFF"&&bytes.subarray(8,12).toString("ascii")==="WEBP";
  if(mime==="image/heic"||mime==="image/heif"){
    if(bytes.length<12)return false;
    const brand=bytes.subarray(4,12).toString("ascii");
    return /^ftyp(heic|heix|hevc|hevx|mif1|msf1)/.test(brand);
  }
  return false;
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
  await ensureWorkspace(input.workspace);
  const id=randomUUID(),dir=root();
  await mkdir(dir,{recursive:true});
  const fileName=`${id}${extension(input.file.type)}`;
  const full=path.join(dir,fileName);
  const bytes=Buffer.from(await input.file.arrayBuffer());
  if(!magicMatches(bytes,input.file.type))throw Object.assign(new Error("Image signature does not match the declared media type."),{status:415});
  await writeFile(full,bytes);
  try{
    await query("INSERT INTO aqua_media_assets(id,workspace_key,tank_id,livestock_id,kind,storage_path,mime_type,size_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[
      id,input.workspace,input.tankId,input.livestockId||null,input.kind||"photo",fileName,input.file.type,bytes.length
    ]);
  }catch(error){
    await unlink(full).catch(()=>{});
    throw error;
  }
  return {id,tankId:input.tankId,livestockId:input.livestockId,kind:input.kind||"photo",mimeType:input.file.type,sizeBytes:bytes.length,url:`/api/media/${id}`};
}

export async function loadMedia(workspace:string,id:string){
  await ensureWorkspace(workspace);
  const result=await query<{storage_path:string;mime_type:string;size_bytes:string|number}>("SELECT storage_path,mime_type,size_bytes FROM aqua_media_assets WHERE workspace_key=$1 AND id=$2",[workspace,id]);
  const row=result.rows[0];
  if(!row)return null;
  const full=path.join(root(),path.basename(row.storage_path));
  const data=await readFile(full);
  return {data,mimeType:row.mime_type,sizeBytes:Number(row.size_bytes)};
}
