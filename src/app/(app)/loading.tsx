// Shown at once while an app page loads on the server, so a tap never looks like nothing happened.
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <div className="pl-band" />
      <div className="pl-row"><div className="pl-card" /><div className="pl-card" /><div className="pl-card" /></div>
      <div className="pl-card pl-tall" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
