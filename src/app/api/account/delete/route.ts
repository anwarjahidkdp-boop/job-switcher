import { removePrivateFolder } from "@/lib/server/account-data";
import { NextResponse } from "next/server";
import { apiCtx, unauthorized } from "@/lib/server/api";
import { disconnectGmail } from "@/lib/server/gmail";

/** "Delete my data": removes stored files, then the auth user (every table cascades from auth.users). */
export async function POST() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
  await removePrivateFolder(c.admin,"cv-files",c.userId);
  const keys: string[]=[];
  for(let from=0;;from+=1000){
    const {data,error}=await c.admin.from("inbound_emails").select("raw_storage_key").eq("user_id",c.userId).not("raw_storage_key","is",null).order("id").range(from,from+999);
    if(error)throw error;
    if((data||[]).some(r=>String(r.raw_storage_key).startsWith("r2:")))throw new Error("External raw-mail cleanup requires operator reconciliation before deleting this account");
    keys.push(...(data||[]).map(r=>String(r.raw_storage_key)));
    if(!data||data.length<1000)break;
  }
  for(let i=0;i<keys.length;i+=100){const {error}=await c.admin.storage.from("inbound-raw").remove(keys.slice(i,i+100));if(error)throw error;}
  await disconnectGmail(c.admin, c.userId).catch(() => {});
  const { error } = await c.admin.auth.admin.deleteUser(c.userId);
  if (error) return NextResponse.json({ error: "Could not delete the account. Try again." }, { status: 500 });
  await c.db.auth.signOut();
  return NextResponse.json({ ok: true });
  }catch(e){console.error("account deletion",e);return NextResponse.json({error:"Could not finish removing your private files. Your account has been kept so you can retry."},{status:500});}
}
