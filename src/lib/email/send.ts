// Outbound transactional email via Resend or Brevo REST APIs (both have free tiers). Server-only keys.
export interface OutboundEmail { to: string; subject: string; html: string; text: string }

export function emailProvider(): "resend" | "brevo" | null {
  const p = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (p === "brevo" && process.env.BREVO_API_KEY) return "brevo";
  if (p === "resend" && process.env.RESEND_API_KEY) return "resend";
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.BREVO_API_KEY) return "brevo";
  return null;
}

export async function sendEmail(msg: OutboundEmail): Promise<{ id: string | null }> {
  const provider = emailProvider();
  const from = process.env.EMAIL_FROM || "Job Switcher <reminders@example.com>";
  if (!provider) throw new Error("No email provider configured (set RESEND_API_KEY or BREVO_API_KEY)");
  if (provider === "resend") {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return { id: ((await r.json()) as { id?: string }).id ?? null };
  }
  const m = from.match(/^(.*)<(.+)>$/);
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: (m?.[1] || "Job Switcher").trim(), email: (m?.[2] || from).trim() }, to: [{ email: msg.to }], subject: msg.subject, htmlContent: msg.html, textContent: msg.text }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { id: ((await r.json()) as { messageId?: string }).messageId ?? null };
}
