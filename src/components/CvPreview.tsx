import type { CSSProperties } from "react";
import { renderCvHtml, resolveStyle, type RenderInput } from "@/lib/cv/render";
import { convention } from "@/lib/cv/conventions";

/** The surrounding document frame is UI only; exports use the shared CV renderer. */
export function CvPreview(props: RenderInput) {
  const { accent } = resolveStyle(props.style, props.country);
  return <section className="cv-preview-frame" style={{"--cv-frame-accent":accent} as CSSProperties} aria-label="CV preview">
    <div className="cv-preview-heading"><span><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>CV preview</span><small>{convention(props.country).paper} document</small></div>
    <div dangerouslySetInnerHTML={{ __html: renderCvHtml(props) }} />
  </section>;
}
