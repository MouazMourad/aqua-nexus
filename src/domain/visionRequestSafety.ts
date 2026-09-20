const ALLOWED=/^data:image\/(jpeg|jpg|png|webp);base64,/i;

export interface VisionRequestSafetyResult{
  ok:boolean;
  error?:string;
  approximateBytes?:number;
}

export function validateVisionDataUrl(dataUrl:string,maxBytes=6*1024*1024):VisionRequestSafetyResult{
  if(typeof dataUrl!=="string"||!ALLOWED.test(dataUrl))return{ok:false,error:"Only JPEG, PNG or WebP data URLs are accepted."};
  const comma=dataUrl.indexOf(",");
  if(comma<0)return{ok:false,error:"Malformed image data URL."};
  const payload=dataUrl.slice(comma+1);
  if(!payload||!/^[A-Za-z0-9+/=\r\n]+$/.test(payload))return{ok:false,error:"Malformed base64 image payload."};
  const padding=(payload.endsWith("==")?2:payload.endsWith("=")?1:0);
  const approximateBytes=Math.max(0,Math.floor(payload.replace(/[\r\n]/g,"").length*3/4)-padding);
  if(approximateBytes>maxBytes)return{ok:false,error:"Image exceeds the Vision request size limit.",approximateBytes};
  return{ok:true,approximateBytes};
}

export function sanitizeVisionQuestion(question:unknown,maxLength=2400){
  if(typeof question!=="string")return "";
  return question.trim().slice(0,maxLength);
}
