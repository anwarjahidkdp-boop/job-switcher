import { LegalPage, SUPPORT_EMAIL } from "../legal/LegalPage";

export const metadata = { title: "Refund Policy", description: "How refunds work for JobPao Pro packs." };

export default function Refund() {
  return (
    <LegalPage title={<>Refund <span>Policy</span></>} sub="Try first, pay only if it helps, and get your money back if it is not right for you.">
      <h2>Try before you pay</h2>
      <p>Every new account gets a 5-day free trial with no card needed, so you can see your matched jobs and documents before paying anything.</p>

      <h2>No surprise charges</h2>
      <p>Pro packs are one-off payments for a fixed period. They never renew automatically, so there is nothing to cancel.</p>

      <h2>7-day money-back guarantee</h2>
      <p>If Pro is not right for you, ask for a refund within 7 days of your payment and we will refund the full amount. After 7 days, or once most of the pack&apos;s period has been used, payments are not refundable, except where the law gives you a right to a refund.</p>
      <p>If you were charged twice or charged by mistake, we always refund the extra payment.</p>

      <h2>If you live in the UK or EU: 14 days to cancel</h2>
      <p>By law you can cancel a card purchase within 14 days. Pro starts as soon as you pay, so at checkout you tick a box asking us to start it straight away. If you then cancel within 14 days:</p>
      <ul>
        <li><b>Days 1 to 7:</b> the full amount back, under our money-back guarantee.</li>
        <li><b>Days 8 to 14:</b> the part you have not used, worked out by days. For example, cancelling on day 10 of a 30-day pack returns 20 of 30 days&apos; price.</li>
      </ul>
      <p>Your Pro access ends when the refund is made. To cancel, email us as shown below; saying &quot;I want to cancel&quot; is enough.</p>

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
