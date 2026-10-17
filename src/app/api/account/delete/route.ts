import { NextResponse } from "next/server";
import { apiCtx, unauthorized } from "@/lib/server/api";
import { disconnectGmail } from "@/lib/server/gmail";

/** "Delete my data": removes stored files, then the auth user (every table cascades from auth.users). */
export async function POST() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  for (const folder of [c.userId, `${c.userId}/cv`]) {
    const { data } = await c.admin.storage.from("cv-files").list(folder, { limit: 1000 });
    const files = (data || []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
    if (files.length) await c.admin.storage.from("cv-files").remove(files);
  }
  const { data: raws } = await c.admin.from("inbound_emails").select("raw_storage_key").eq("user_id", c.userId).not("raw_storage_key", "is", null);
  const keys = (raws || []).map((r) => r.raw_storage_key as string).filter((k) => !k.startsWith("r2:"));
  if (keys.length) await c.admin.storage.from("inbound-raw").remove(keys);
  await disconnectGmail(c.admin, c.userId).catch(() => {});
  const { error } = await c.admin.auth.admin.deleteUser(c.userId);
  if (error) return NextResponse.json({ error: "Could not delete the account. Try again." }, { status: 500 });
  await c.db.auth.signOut();
  return NextResponse.json({ ok: true });
}
