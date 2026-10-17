-- Row Level Security on every table. The service role (server-side only) bypasses RLS;
-- browsers only ever hold the anon key + the user's JWT.

alter table public.country_rules        enable row level security;
alter table public.plans                enable row level security;
alter table public.profiles             enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.cv_documents         enable row level security;
alter table public.career_facts         enable row level security;
alter table public.master_cvs           enable row level security;
alter table public.ingestion_sources    enable row level security;
alter table public.jobs                 enable row level security;
alter table public.matches              enable row level security;
alter table public.applications         enable row level security;
alter table public.application_events   enable row level security;
alter table public.reminders            enable row level security;
alter table public.forwarding_addresses enable row level security;
alter table public.inbound_emails       enable row level security;
alter table public.ai_usage             enable row level security;

-- Reference data: readable by everyone, writable by nobody but the service role.
create policy country_rules_read on public.country_rules for select to anon, authenticated using (true);
create policy plans_read on public.plans for select to anon, authenticated using (active);

-- Profiles: own row only. Rows are created by the auth trigger.
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Subscriptions: read own. Changes only via the service role (payment integration, deferred).
create policy subscriptions_select on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

-- Own-row tables (full CRUD on own data).
create policy cv_documents_own on public.cv_documents for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy career_facts_own on public.career_facts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy master_cvs_own on public.master_cvs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy matches_own on public.matches for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy applications_own on public.applications for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reminders_own on public.reminders for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Events: users read their own and may only append user-authored events.
create policy application_events_select on public.application_events for select to authenticated using (user_id = (select auth.uid()));
create policy application_events_insert on public.application_events for insert to authenticated
  with check (user_id = (select auth.uid()) and actor = 'user'
              and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid())));

-- Jobs: public listings for everyone signed in; private jobs (pasted / from the user's alerts) only for their owner.
create policy jobs_select on public.jobs for select to authenticated using ((owner_id is null and active) or owner_id = (select auth.uid()));
create policy jobs_insert_paste on public.jobs for insert to authenticated with check (owner_id = (select auth.uid()) and source_kind = 'paste');
create policy jobs_update_own on public.jobs for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy jobs_delete_own on public.jobs for delete to authenticated using (owner_id = (select auth.uid()));

-- Forwarding address: read own; created only through ensure_forwarding_address().
create policy forwarding_select on public.forwarding_addresses for select to authenticated using (user_id = (select auth.uid()));

-- Inbound emails & AI usage: read own; written by the service role.
create policy inbound_emails_select on public.inbound_emails for select to authenticated using (user_id = (select auth.uid()));
create policy ai_usage_select on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

-- ingestion_sources: no policies => service role only.

grant execute on function public.ai_budget(uuid) to authenticated, service_role;
grant execute on function public.ensure_forwarding_address(text) to authenticated;
revoke execute on function public.ensure_forwarding_address(text) from anon, public;

-- ---------------------------------------------------------------------------
-- Storage: private buckets, per-user folders, signed URLs only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cv-files', 'cv-files', false, 10485760, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/jpeg','image/png','image/webp']),
  ('inbound-raw', 'inbound-raw', false, 26214400, array['message/rfc822','text/plain'])
on conflict (id) do update set public = false;

-- cv-files/<user_id>/... : the owner may read/write their own folder. Nobody else (no public access).
create policy cv_files_select on storage.objects for select to authenticated
  using (bucket_id = 'cv-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy cv_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cv-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy cv_files_update on storage.objects for update to authenticated
  using (bucket_id = 'cv-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy cv_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cv-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- inbound-raw: no policies => service role only.
