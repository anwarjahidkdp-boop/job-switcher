-- Where a CV's text came from: extracted from the uploaded file in the browser, pasted, transcribed from
-- photos/scans by AI (and checked by the user before use), or the built-in demo CV.
alter table public.cv_documents
  add column if not exists text_source text not null default 'file'
  check (text_source in ('file', 'paste', 'ocr', 'demo'));
update public.cv_documents set text_source = case when is_demo then 'demo' when storage_path is null then 'paste' else 'file' end;
