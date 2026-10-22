import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {verifyBackup,requireRecoveryTarget,postgresEnv,sha256,assertDatabaseProject,recoveryPlatformEntries} from './full';
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

it('restores the app signup trigger and storage policies without replaying platform-owned DDL',()=>{
 const entries=['1; 0 0 TRIGGER auth users on_auth_user_created postgres','2; 0 0 TRIGGER auth users managed_platform_trigger supabase_auth_admin','3; 0 0 POLICY storage objects cv_owner postgres','4; 0 0 ACL storage TABLE objects supabase_storage_admin','5; 0 0 TABLE auth users supabase_auth_admin'];
 const chosen=recoveryPlatformEntries(entries.join('\n'));expect(chosen.split('\n')).toEqual([entries[0],entries[2],entries[3]]);
});
