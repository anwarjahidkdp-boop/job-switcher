"use client";
import Link from "next/link";
// Last resort when even the page frame fails: plain HTML, no app styles needed.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#14275A", color: "#fff", margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
        <main role="alert" style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>JobPao could not load</h1>
          <p style={{ opacity: 0.85 }}>Something went wrong on our side. Your data is safe.</p>
          <p style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => reset()} style={{ background: "#C99640", color: "#14275A", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>Try again</button>
            <Link href="/" style={{ color: "#fff", padding: "10px 16px" }}>Go to the home page</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
