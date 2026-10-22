# Ambiguous Gmail sends

Never clear `applications.sending_at` on a timer. A timeout, dropped connection, Gmail 408/5xx, or malformed success may conceal an accepted email. JobPao requests only `gmail.send`; it cannot inspect the user's Sent mailbox. Never request broader mailbox access just to reconcile.

1. Identify the owned application, recipient, subject and claim timestamp. Check its application events and protected server logs for a Gmail message id. Do not send a test application.
2. Ask the user to inspect Gmail Sent for that exact recipient, subject and time, including attachments. A missing search result alone is not proof of non-delivery.
3. If accepted, keep the claim. The user can mark the application as applied. If that hits a usage limit, an operator must reconcile the existing delivery and allowance; never send again.
4. If outcome remains uncertain, keep blocked. Do not automatically retry or tell the user a timeout means failure.
5. Only after positive evidence of rejection/non-delivery (or explicit user-authorized resend after reviewing duplication risk), an operator can clear the exact claim using a compare-and-set update scoped to application id, user id, previous `sending_at`, and a non-submitted status. Record evidence and operator identity in the audit log. Verify exactly one row changed. The next send still requires the user's Apply press.

Explicit pre-send token failures and definitive Gmail 4xx rejections other than 408 release the claim for a fresh user-initiated attempt. Database errors before claiming fail closed. Successful sends retain the claim even when receipt/status/auxiliary writes fail.

No destructive migration or automatic reset is part of this procedure. Database application claims cover a single user/job; cross-listing duplicates need canonical job identity and must not be assumed covered by this guard.
