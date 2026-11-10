import { LegalPage, SUPPORT_EMAIL } from "../legal/LegalPage";

export const metadata = { title: "Refund Policy", description: "How refunds work for JobPao Pro packs.", alternates: { canonical: "/refund" } };

export default function Refund() {
  return (
    <LegalPage title={<>Refund <span>Policy</span></>} sub="Try it free first, then pay only if it helps. Clear rules and no surprise charges.">
      <h2>Try before you pay</h2>
      <p>Every new account gets a 5-day free trial with no card needed, so you can see your matched jobs and documents before paying anything.</p>

      <h2>No surprise charges</h2>
      <p>Pro packs are one-off payments for a fixed period. They never renew automatically, so there is nothing to cancel.</p>

      <h2>When we refund</h2>
      <p>Because you can try JobPao free before you pay, Pro packs are not refundable once your Pro time has started, except in these cases:</p>
      <ul>
        <li><b>Charged twice or by mistake:</b> we always refund the extra payment.</li>
        <li><b>A fault on our side:</b> if JobPao stops working for you and we cannot fix it, we refund the days you could not use.</li>
        <li><b>Where the law gives you a right to a refund</b>, such as the UK and EU rule below.</li>
      </ul>

      <h2>If you live in the UK or EU: 14 days to cancel</h2>
      <p>By law you can cancel a card purchase within 14 days. Pro starts as soon as you pay, so at checkout you tick a box asking us to start it straight away. If you then cancel within 14 days, you pay only for the time you had: we refund the days you have not used, worked out by days. For example, cancelling on day 4 of a 30-day pack returns 26 of 30 days&apos; price.</p>
      <p>Your Pro access ends when the refund is made. To cancel, email us as shown below; saying &quot;I want to cancel&quot; is enough.</p>

      <h2>Fair use</h2>
      <p>We may decline new purchases from anyone who keeps buying Pro and cancelling after using it, or who opens extra accounts to get more free trials.</p>

      <h2>How to ask</h2>
      <p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from your account email and include your payment reference (the order number on your receipt, or your bKash transaction ID). We reply within 3 working days.</p>

      <h2>How you get the money back</h2>
      <ul>
        <li><b>Card payments</b> are refunded by Creem, our reseller, to the same card. Your bank may take 5 to 10 working days to show it.</li>
        <li><b>bKash payments</b> are sent back to the bKash number you paid from.</li>
      </ul>
      <p>When a refund is made, the Pro time from that payment is removed from your account.</p>
    </LegalPage>
  );
}
