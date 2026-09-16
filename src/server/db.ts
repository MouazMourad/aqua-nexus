import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForAqua=globalThis as unknown as { aquaPgPool?:Pool; aquaSchemaReady?:Promise<void> };

export class BackendUnavailableError extends Error {
  status=503;
  constructor(message="Aqua Nexus backend database is not configured."){super(message);this.name="BackendUnavailableError";}
}

export function dbConfigured(){return Boolean(process.env.DATABASE_URL);}

function pool(){
  if(!process.env.DATABASE_URL)throw new BackendUnavailableError();
  if(!globalForAqua.aquaPgPool){
    globalForAqua.aquaPgPool=new Pool({
      connectionString:process.env.DATABASE_URL,
      max:Number(process.env.DATABASE_POOL_MAX||10),
      idleTimeoutMillis:30000,
      connectionTimeoutMillis:8000,
      ssl:process.env.DATABASE_SSL==="require"?{rejectUnauthorized:false}:undefined
    });
  }
  return globalForAqua.aquaPgPool;
}

const schemaSql=`
CREATE TABLE IF NOT EXISTS aqua_workspaces (
  workspace_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS aqua_tanks (
  workspace_key text NOT NULL REFERENCES aqua_workspaces(workspace_key) ON DELETE CASCADE,
  tank_id text NOT NULL,
  name text NOT NULL,
  tank_type text NOT NULL,
  data jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_key,tank_id)
);
CREATE INDEX IF NOT EXISTS aqua_tanks_updated_idx ON aqua_tanks(workspace_key,updated_at DESC);
CREATE TABLE IF NOT EXISTS aqua_push_subscriptions (
  id bigserial PRIMARY KEY,
  workspace_key text NOT NULL REFERENCES aqua_workspaces(workspace_key) ON DELETE CASCADE,
  endpoint text NOT NULL,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_key,endpoint)
);
CREATE TABLE IF NOT EXISTS aqua_media_assets (
  id text PRIMARY KEY,
  workspace_key text NOT NULL REFERENCES aqua_workspaces(workspace_key) ON DELETE CASCADE,
  tank_id text NOT NULL,
  livestock_id text,
  kind text NOT NULL DEFAULT 'photo',
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aqua_media_tank_idx ON aqua_media_assets(workspace_key,tank_id,created_at DESC);
CREATE TABLE IF NOT EXISTS aqua_ai_audit (
  id bigserial PRIMARY KEY,
  workspace_key text NOT NULL REFERENCES aqua_workspaces(workspace_key) ON DELETE CASCADE,
  tank_id text,
  mode text NOT NULL,
  question text,
  provider text NOT NULL,
  model text,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aqua_ai_audit_idx ON aqua_ai_audit(workspace_key,created_at DESC);
CREATE TABLE IF NOT EXISTS aqua_job_runs (
  id bigserial PRIMARY KEY,
  job_name text NOT NULL,
  status text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

export async function ensureBackendSchema(){
  if(!dbConfigured())throw new BackendUnavailableError();
  if(!globalForAqua.aquaSchemaReady){
    globalForAqua.aquaSchemaReady=(async()=>{await pool().query(schemaSql);})();
  }
  return globalForAqua.aquaSchemaReady;
}

export async function query<T extends QueryResultRow=QueryResultRow>(text:string,params:any[]=[]){
  await ensureBackendSchema();
  return pool().query<T>(text,params);
}

export async function transaction<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T>{
  await ensureBackendSchema();
  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const out=await fn(client);
    await client.query("COMMIT");
    return out;
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{client.release();}
}
