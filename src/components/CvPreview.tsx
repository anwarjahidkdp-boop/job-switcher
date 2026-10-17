import { renderCvHtml, type RenderInput } from "@/lib/cv/render";

/** Server-rendered CV preview. renderCvHtml escapes every user-supplied value. */
export function CvPreview(props: RenderInput) {
  return <div dangerouslySetInnerHTML={{ __html: renderCvHtml(props) }} />;
}
