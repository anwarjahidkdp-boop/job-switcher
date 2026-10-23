import Link from "next/link";

/** Navy + gold band across the top of a page, in the same look as the home hero. The content after it rises into the band as white cards. */
export function PageHead({ kicker, title, sub, back, slim, compact }: { kicker?: React.ReactNode; title?: React.ReactNode; sub?: React.ReactNode; back?: { href: string; label: string }; slim?: boolean; compact?: boolean }) {
  return (
    <section className={`pghead${slim ? " pghead-slim" : ""}${compact ? " pghead-compact" : ""}`}>
      <div className="pghead-in">
        {back ? <Link prefetch={false} className="pghead-back" href={back.href}>← {back.label}</Link> : null}
        {kicker ? <p className="pghead-kicker">{kicker}</p> : null}
        {title ? <h1>{title}</h1> : null}
        {sub ? <p className="pghead-sub">{sub}</p> : null}
      </div>
    </section>
  );
}
