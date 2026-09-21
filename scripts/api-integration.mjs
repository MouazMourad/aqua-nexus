import {spawn} from "node:child_process";

const port=3101,base=`http://127.0.0.1:${port}`,device="ci-device-aqua-nexus-1234567890";
const headers={"content-type":"application/json","x-aqua-device-id":device};

const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{
  stdio:["ignore","pipe","pipe"],env:{...process.env,PORT:String(port)}
});
let logs="";
server.stdout.on("data",d=>logs+=d.toString());
server.stderr.on("data",d=>logs+=d.toString());

async function wait(){
  for(let i=0;i<60;i++){
    try{const r=await fetch(base+"/api/health");if(r.ok){const j=await r.json();if(j.database==="ready")return}}catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  throw new Error("Next API did not become ready\n"+logs);
}
function tank(name="CI Tank"){
  return{
    id:"ci-tank",name,type:"marine",status:"mature",ageMonths:12,
    display:{length:100,width:50,height:50,displacementPercent:10},
    sump:{enabled:false,dimensions:{length:1,width:1,height:1},operatingFillPercent:0,chambers:[]},
    systemVolumeLiters:225,equipment:[],chemistry:[],maintenance:[],livestock:[],inventory:[],timeline:[],
    createdAt:new Date().toISOString()
  };
}
async function json(path,init={}){
  const r=await fetch(base+path,init);let body={};try{body=await r.json()}catch{}
  return{r,body};
}
try{
  await wait();
  let x=await json("/api/tanks/ci-tank",{method:"PUT",headers,body:JSON.stringify({tank:tank()})});
  if(!x.r.ok||x.body.version!==1)throw new Error("Initial tank PUT failed "+JSON.stringify(x.body));

  x=await json("/api/tanks/ci-tank",{headers});
  if(!x.r.ok||x.body.tank?.name!=="CI Tank"||x.body.version!==1)throw new Error("Tank GET failed "+JSON.stringify(x.body));

  x=await json("/api/tanks/ci-tank",{method:"PUT",headers,body:JSON.stringify({tank:tank("CI Tank Updated"),expectedVersion:1})});
  if(!x.r.ok||x.body.version!==2)throw new Error("Versioned tank PUT failed "+JSON.stringify(x.body));

  x=await json("/api/tanks/ci-tank",{method:"PUT",headers,body:JSON.stringify({tank:tank("Stale"),expectedVersion:1})});
  if(x.r.status!==409||x.body.conflict!==true)throw new Error("Stale version did not conflict "+JSON.stringify(x.body));

  const isolated=await json("/api/tanks/ci-tank",{headers:{...headers,"x-aqua-device-id":"ci-device-other-1234567890"}});
  if(isolated.r.status!==404)throw new Error("Workspace isolation failed "+isolated.r.status);

  const tinyPng="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2r0sAAAAASUVORK5CYII=";
  const lightingVision=await json("/api/ai/lighting-import",{method:"POST",headers,body:JSON.stringify({
    tank:tank("Lighting Vision CI"),sourceKind:"image",sourceCompany:"generic",fileName:"schedule.png",fileType:"image/png",imageDataUrl:tinyPng,language:"en"
  })});
  if(lightingVision.r.status!==503||!String(lightingVision.body?.error||"").toLowerCase().includes("provider")){
    throw new Error("Lighting import route did not fail closed without a configured AI provider "+JSON.stringify(lightingVision.body));
  }

  const equipmentVision=await json("/api/ai/equipment-import",{method:"POST",headers,body:JSON.stringify({
    tank:tank("Equipment Vision CI"),sourceKind:"image",vendor:"generic",fileName:"equipment.png",fileType:"image/png",imageDataUrl:tinyPng,language:"en"
  })});
  if(equipmentVision.r.status!==503||!String(equipmentVision.body?.error||"").toLowerCase().includes("provider")){
    throw new Error("Equipment import route did not fail closed without a configured AI provider "+JSON.stringify(equipmentVision.body));
  }

  x=await json("/api/tanks/ci-tank?expectedVersion=2",{method:"DELETE",headers});
  if(!x.r.ok||x.body.deleted!==true)throw new Error("Versioned delete failed "+JSON.stringify(x.body));

  console.log("Backend integration: health, migrations, workspace isolation, optimistic versioning and lighting/equipment import guards OK");
}finally{
  if(server.exitCode===null){
    server.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve=>server.once("exit",resolve)),
      new Promise(resolve=>setTimeout(resolve,3000))
    ]);
    if(server.exitCode===null)server.kill("SIGKILL");
  }
}
