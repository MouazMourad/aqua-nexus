import type { Tank } from "@/domain/types";
import { query, transaction } from "./db";
import { ensureWorkspace } from "./workspace";

interface TankRow { tank_id:string; name:string; tank_type:string; data:Tank; version:string|number; updated_at:string; }

function cleanTank(tank:Tank):Tank{
  return JSON.parse(JSON.stringify(tank)) as Tank;
}

export async function listTanks(workspace:string){
  await ensureWorkspace(workspace);
  const result=await query<TankRow>("SELECT tank_id,name,tank_type,data,version,updated_at FROM aqua_tanks WHERE workspace_key=$1 ORDER BY updated_at DESC",[workspace]);
  return result.rows.map(r=>({tank:r.data,version:Number(r.version),updatedAt:r.updated_at}));
}

export async function getTank(workspace:string,id:string){
  await ensureWorkspace(workspace);
  const result=await query<TankRow>("SELECT tank_id,name,tank_type,data,version,updated_at FROM aqua_tanks WHERE workspace_key=$1 AND tank_id=$2",[workspace,id]);
  const row=result.rows[0];
  return row?{tank:row.data,version:Number(row.version),updatedAt:row.updated_at}:null;
}

export async function upsertTank(workspace:string,tank:Tank,expectedVersion?:number){
  await ensureWorkspace(workspace);
  const data=cleanTank(tank);
  if(expectedVersion!==undefined){
    const result=await query<TankRow>(`
      UPDATE aqua_tanks SET name=$3,tank_type=$4,data=$5::jsonb,version=version+1,updated_at=now()
      WHERE workspace_key=$1 AND tank_id=$2 AND version=$6
      RETURNING tank_id,name,tank_type,data,version,updated_at
    `,[workspace,tank.id,tank.name,tank.type,JSON.stringify(data),expectedVersion]);
    if(result.rowCount===0){
      const current=await getTank(workspace,tank.id);
      if(current) return {conflict:true as const,current};
    }else{
      const row=result.rows[0];
      return {conflict:false as const,tank:row.data,version:Number(row.version),updatedAt:row.updated_at};
    }
  }
  const result=await query<TankRow>(`
    INSERT INTO aqua_tanks(workspace_key,tank_id,name,tank_type,data)
    VALUES($1,$2,$3,$4,$5::jsonb)
    ON CONFLICT(workspace_key,tank_id) DO UPDATE SET
      name=excluded.name,tank_type=excluded.tank_type,data=excluded.data,version=aqua_tanks.version+1,updated_at=now()
    RETURNING tank_id,name,tank_type,data,version,updated_at
  `,[workspace,tank.id,tank.name,tank.type,JSON.stringify(data)]);
  const row=result.rows[0];
  return {conflict:false as const,tank:row.data,version:Number(row.version),updatedAt:row.updated_at};
}

export async function deleteTank(workspace:string,id:string){
  await ensureWorkspace(workspace);
  const result=await query("DELETE FROM aqua_tanks WHERE workspace_key=$1 AND tank_id=$2",[workspace,id]);
  return (result.rowCount??0)>0;
}

export async function importTanks(workspace:string,tanks:Tank[]){
  await ensureWorkspace(workspace);
  return transaction(async client=>{
    const out:any[]=[];
    for(const tank of tanks){
      const data=cleanTank(tank);
      const result=await client.query<TankRow>(`
        INSERT INTO aqua_tanks(workspace_key,tank_id,name,tank_type,data)
        VALUES($1,$2,$3,$4,$5::jsonb)
        ON CONFLICT(workspace_key,tank_id) DO UPDATE SET
          name=excluded.name,tank_type=excluded.tank_type,data=excluded.data,version=aqua_tanks.version+1,updated_at=now()
        RETURNING tank_id,name,tank_type,data,version,updated_at
      `,[workspace,tank.id,tank.name,tank.type,JSON.stringify(data)]);
      const row=result.rows[0];
      out.push({tank:row.data,version:Number(row.version),updatedAt:row.updated_at});
    }
    return out;
  });
}
