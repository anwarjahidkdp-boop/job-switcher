import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { requireUser } from "@/lib/server/page";
import { listNotifications, markAllRead, type NotificationKind } from "@/lib/server/notify";

export const metadata = { title: "Notifications" };

const ICON: Record<NotificationKind, string> = { match: "★", ready: "✓", reminder: "⏰", reply: "✉", followup: "✉", interview: "🎤", guide: "📈", trial: "🎁" };
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export default async function Notifications() {
  const { supabase, user } = await requireUser("/notifications");
  const items = await listNotifications(supabase, user.id);
  // Opening the list counts as reading it; the "new" dots below still show what was unread when it opened.
  if (items.some((n) => !n.read_at)) await markAllRead(supabase, user.id);
  return (
    <>
      <PageHead kicker="Your job assistant" title={<>What&apos;s <span>new</span></>} sub="New matches, ready applications, replies to check and interview reminders. We also email the important ones." />
      <div className="card panel" style={{ marginTop: 16, maxWidth: 760 }}>
        {items.length ? items.map((n) => (
          <Link key={n.id} href={n.link || "/inbox"} className={`ntf ${n.read_at ? "" : "new"}`}>
            <span className="ntf-ic" aria-hidden="true">{ICON[n.kind] || "•"}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b>{n.title}</b>{n.body ? <span className="small muted" style={{ display: "block", marginTop: 2 }}>{n.body}</span> : null}<span className="small muted" style={{ display: "block", marginTop: 4 }}>{ago(n.created_at)}</span></span>
            {n.read_at ? null : <span className="ntf-dot" aria-label="New" />}
          </Link>
        )) : <p className="muted">Nothing yet. When we find a strong match or your application is ready, it shows up here.</p>}
      </div>
    </>
  );
}
