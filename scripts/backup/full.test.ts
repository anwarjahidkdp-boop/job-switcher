import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {verifyBackup,requireRecoveryTarget,postgresEnv,sha256,assertDatabaseProject} from './full';
describe('backup recovery safeguards',()=>{
 it('rejects production, same-project and unacknowledged restore targets',()=>{
  for(const [source,target,ack] of [['source','hplxsueitluutdbkbupi','hplxsueitluutdbkbupi'],['source','source','source'],['source','target',undefined]])expect(()=>requireRecoveryTarget(source!,target!,ack)).toThrow();
  expect(()=>requireRecoveryTarget('source','isolated','isolated')).not.toThrow();
 });
 it('validates every file before restoring and rejects tampering or path traversal',()=>{
  const folder=mkdtempSync(join(tmpdir(),'backup-test-'));try{
   const data=Buffer.from('synthetic');writeFileSync(join(folder,'db.dump'),data);
   const m={format:1,complete:true,database:{file:'db.dump',sha256:sha256(data)},objects:[]};
   const save=()=>writeFileSync(join(folder,'full-manifest.json'),JSON.stringify(m));save();expect(verifyBackup(folder)).toMatchObject({complete:true});
   writeFileSync(join(folder,'db.dump'),'changed');expect(()=>verifyBackup(folder)).toThrow('checksum');
   m.database.file='../escape';save();expect(()=>verifyBackup(folder)).toThrow();
   m.complete=false;save();expect(()=>verifyBackup(folder)).toThrow('complete');
  }finally{rmSync(folder,{recursive:true,force:true});}
 });
 it('keeps database credentials in environment variables and requires TLS',()=>{
  const env=postgresEnv('postgresql://postgres.target:fake%40secret@db.target.supabase.co:5432/postgres');expect(env.PGPASSWORD).toBe('fake@secret');expect(env.PGSSLMODE).toBe('require');expect(env.PGHOST).toBe('db.target.supabase.co');
 });
});

it('binds the database to the exact Supabase project, including pooler usernames',()=>{
 expect(()=>assertDatabaseProject('postgresql://postgres:fake@db.isolated.supabase.co/postgres','isolated')).not.toThrow();
 expect(()=>assertDatabaseProject('postgresql://postgres.isolated:fake@aws-0-seoul.pooler.supabase.com/postgres','isolated')).not.toThrow();
 expect(()=>assertDatabaseProject('postgresql://postgres.isolated:fake@db.hplxsueitluutdbkbupi.supabase.co/postgres','isolated')).toThrow();
 expect(()=>assertDatabaseProject('postgresql://postgres:fake@db.isolated.supabase.co.evil.invalid/postgres','isolated')).toThrow();
});
