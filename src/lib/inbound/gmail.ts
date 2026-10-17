// Detects Gmail's "forwarding confirmation" email (sent when the user adds their JobPao
// address in Gmail settings) and pulls out the confirmation code so the setup guide can show it.
export interface GmailVerification { code: string; forwardingFrom: string | null }

const GMAIL_SENDER = /forwarding-noreply@google\.com/i;

export function detectGmailVerification(m: { from: string; subject: string; text: string; authResults?: string | null }): GmailVerification | null {
  if (!GMAIL_SENDER.test(m.from)) return null;
  if (!/gmail forwarding confirmation|forwarding confirmation/i.test(m.subject) && !/confirmation code/i.test(m.text)) return null;
  // If the receiving MTA recorded authentication results, require Google's signature to pass.
  if (m.authResults && !/dkim=pass[^;]*google\.com|spf=pass[^;]*google\.com/i.test(m.authResults)) return null;
  const code = m.subject.match(/\(#\s?(\d{6,12})\)/)?.[1] || m.text.match(/confirmation code:?\s*(\d{6,12})/i)?.[1];
  if (!code) return null;
  const forwardingFrom = m.subject.match(/receive mail from\s+([^\s]+@[^\s]+)/i)?.[1] || m.text.match(/([A-Z0-9._%+-]+@gmail\.com) has requested/i)?.[1] || null;
  return { code, forwardingFrom };
}
