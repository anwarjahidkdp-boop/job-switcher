-- Defence in depth: these tables are read and written only by the server (service role).
-- RLS already blocks browsers because they have no policies; removing the grants as well means a
-- future policy added by mistake still cannot expose Gmail tokens, email logs or ingestion internals.
revoke all on table public.gmail_connections from anon, authenticated;
revoke all on table public.email_deliveries from anon, authenticated;
revoke all on table public.ingestion_sources from anon, authenticated;
revoke all on table public.ingestion_source_quarantine from anon, authenticated;
revoke all on table public.job_canonical_keys from anon, authenticated;
revoke all on table public.source_documents from anon, authenticated;
