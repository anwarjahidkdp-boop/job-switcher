"use server";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/page";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/billing/manual";
import { reviewPayment } from "@/lib/server/billing";

/** Owner-only: the signed-in user's confirmed email must be listed in ADMIN_EMAILS. Checked on every action. */
export async function requireAdmin() {
  const { user } = await requireUser("/admin/payments");
  if (!user.email || !user.email_confirmed_at || !isAdminEmail(user.email)) notFound();
  return user.email;
}

export async function reviewPaymentAction(formData: FormData) {
  const reviewer = await requireAdmin();
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (decision !== "approve" && decision !== "reject")) return;
  await reviewPayment(createAdminClient(), { paymentId: id, approve: decision === "approve", reviewer, note: String(formData.get("note") || "") });
  revalidatePath("/admin/payments");
}
