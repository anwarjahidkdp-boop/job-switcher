// Database + Auth + private Storage bytes. CLI only; credentials never enter argv/logs.
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync,writeFileSync,readFileSync,existsSync} from "node:fs";
import {join,resolve} from "node:path";
import type {SupabaseClient} from "@supabase/supabase-js";
export const sha256=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
export function postgresEnv(uri:string){
 const u=new URL(uri);if(!['postgres:','postgresql:'].includes(u.protocol))throw new Error('PostgreSQL URL required');
 return {...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.slice(1)||'postgres',PGSSLMODE:'require'};
}
export function pg(command:string,args:string[],uri:string,input?:string){return new Promise<void>((ok,fail)=>{
 const child=spawn(command,args,{env:postgresEnv(uri),stdio:['pipe','ignore','pipe']});
 // Database errors may include connection parameters. Keep provider output private.
 child.stderr.resume();child.on('error',()=>fail(new Error(`${command} unavailable`)));child.on('close',c=>c===0?ok():fail(new Error(`${command} failed (exit ${c}); inspect the private runner`)));child.stdin.end(input);
});}
function pgOutput(command:string,args:string[],uri:string){return new Promise<string>((ok,fail)=>{
 const child=spawn(command,args,{env:postgresEnv(uri),stdio:['ignore','pipe','pipe']});let out="";
 child.stdout.setEncoding('utf8');child.stdout.on('data',part=>{out+=part;});child.stderr.resume();child.on('error',()=>fail(new Error(`${command} unavailable`)));child.on('close',c=>c===0?ok(out):fail(new Error(`${command} failed (exit ${c})`)));
});}
interface ObjectCopy {bucket:string;name:string;file:string;sha256:string;size:number;metadata:Record<string,unknown>}
export interface FullManifest {format:1;complete:true;project:string;at:string;database:{file:string;sha256:string};objects:ObjectCopy[];buckets:unknown[]}
export async function fullBackup(db:SupabaseClient,out:string,dbUrl:string,project:string){
 mkdirSync(out,{recursive:true,mode:0o700});const dump='database.dump';
 const {data:buckets,error}=await db.storage.listBuckets();if(error)throw error;
 const objects:ObjectCopy[]=[];
 // Storage schema is deliberately not exposed via REST. Export metadata over the private DB connection.
 const metadataSql="select coalesce(json_agg(t order by id),'[]'::json) from storage.objects t";
 const rows=JSON.parse(await pgOutput('psql',['-X','-v','ON_ERROR_STOP=1','--tuples-only','--no-align','--command',metadataSql],dbUrl));
 await pg('pg_dump',['--format=custom','--no-owner','--file',join(out,dump),'--schema=public','--schema=auth','--schema=storage'],dbUrl);
 for(const row of rows){
  const {data:blob,error:download}=await db.storage.from(row.bucket_id).download(row.name);if(download||!blob)throw new Error('Storage download failed: full backup incomplete');
  const bytes=Buffer.from(await blob.arrayBuffer());const file=`objects/${sha256(Buffer.from(`${row.bucket_id}/${row.name}`))}`;
  mkdirSync(join(out,'objects'),{recursive:true,mode:0o700});writeFileSync(join(out,file),bytes,{mode:0o600});
  objects.push({bucket:row.bucket_id,name:row.name,file,sha256:sha256(bytes),size:bytes.length,metadata:row});
 }
 const after=JSON.parse(await pgOutput('psql',['-X','-v','ON_ERROR_STOP=1','--tuples-only','--no-align','--command',metadataSql],dbUrl));
 if(JSON.stringify(rows)!==JSON.stringify(after))throw new Error('Storage changed during backup; retry in a quiet window');

 const m:FullManifest={format:1,complete:true,project,at:new Date().toISOString(),database:{file:dump,sha256:sha256(readFileSync(join(out,dump)))},objects,buckets:buckets||[]};
 writeFileSync(join(out,'full-manifest.json'),JSON.stringify(m),{mode:0o600});return m;
}
/** Validate every artifact before making any change to a fresh recovery project. */
export function verifyBackup(folder:string):FullManifest {
 const m=JSON.parse(readFileSync(join(folder,'full-manifest.json'),'utf8')) as FullManifest;
 if(m.format!==1||m.complete!==true||!Array.isArray(m.objects))throw new Error('Not a complete backup');
 for(const f of [m.database,...m.objects]){
  const path=resolve(folder,f.file);if(!path.startsWith(resolve(folder)+'/')||!existsSync(path)||sha256(readFileSync(path))!==f.sha256)throw new Error('Backup checksum/path validation failed');
 }
 return m;
}
export function requireRecoveryTarget(source:string,target:string,ack:string|undefined){
 if(!target||target===source||target==='hplxsueitluutdbkbupi'||ack!==target)throw new Error('Restore requires a distinct isolated project and RESTORE_EMPTY_PROJECT_ACK matching its ref');
}
export async function restoreBackup(db:SupabaseClient,folder:string,uri:string,target:string){
 const m=verifyBackup(folder);requireRecoveryTarget(m.project,target,process.env.RESTORE_EMPTY_PROJECT_ACK);
 const u=new URL(uri);const identity=`${u.hostname}/${decodeURIComponent(u.username)}`;
 if(!identity.includes(target))throw new Error('Database URL does not identify the isolated target project');
 await pg('psql',['-X','-v','ON_ERROR_STOP=1'],uri,`do $$ begin if exists(select 1 from auth.users) or exists(select 1 from storage.objects) or exists(select 1 from information_schema.tables where table_schema='public' and table_name in ('profiles','applications','jobs')) then raise exception 'Recovery project must be empty'; end if; end $$;`);
 // Platform-managed Auth/Storage schema already exists. Restore public schema and all data without replaying platform DDL.
 await pg('pg_restore',['--exit-on-error','--no-owner','--schema-only','--schema=public',join(folder,m.database.file)],uri);
 const toc=await pgOutput('pg_restore',['--list',join(folder,m.database.file)],uri);
 const listFile=join(folder,'restore-data.list');writeFileSync(listFile,toc.split('\n').filter(line=>!(/TABLE DATA (auth schema_migrations|storage migrations) /.test(line))).join('\n'),{mode:0o600});
 await pg('pg_restore',['--exit-on-error','--no-owner','--no-privileges','--data-only','--disable-triggers','--use-list',listFile,join(folder,m.database.file)],uri);
 for(const o of m.objects){const {error}=await db.storage.from(o.bucket).upload(o.name,readFileSync(join(folder,o.file)),{upsert:true,contentType:String((o.metadata.metadata as Record<string,unknown>)?.mimetype||'application/octet-stream')});if(error)throw new Error('Recovery object upload failed');}
 // Uploads may alter owner/metadata. Restore those fields from the original rows using JSON, not interpolated identifiers.
 const rows=JSON.stringify(m.objects.map(o=>o.metadata));const literal="'"+rows.replaceAll("'","''")+"'";
 await pg('psql',['-X','-v','ON_ERROR_STOP=1'],uri,`update storage.objects o set owner=x.owner,owner_id=x.owner_id,metadata=x.metadata,created_at=x.created_at,updated_at=x.updated_at from jsonb_populate_recordset(null::storage.objects,${literal}::jsonb) x where o.id=x.id;`);
 for(const o of m.objects){const {data,error}=await db.storage.from(o.bucket).download(o.name);if(error||!data||sha256(Buffer.from(await data.arrayBuffer()))!==o.sha256)throw new Error('Recovered object checksum mismatch');}
}
