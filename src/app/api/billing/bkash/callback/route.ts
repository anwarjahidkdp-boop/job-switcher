import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeCheckout } from "@/lib/server/billing";
import { publicEnv } from "@/lib/env";

/**
 * bKash redirects the customer here after the checkout page: ?paymentID=...&status=success|failure|cancel.
 * The status parameter is not trusted: completeCheckout executes and then queries bKash before activating Pro.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const paymentID = (u.searchParams.get("paymentID") || "").slice(0, 100);
  const status = (u.searchParams.get("status") || "").toLowerCase();
  let result = "unknown";
  try {
    result = await completeCheckout(createAdminClient(), paymentID, status);
  } catch (e) {
    console.error("bkash callback", e);
    result = "error";
  }
  return NextResponse.redirect(new URL(`/upgrade?payment=${result}`, publicEnv.appUrl), 303);
}
