-- Follow-up to 024 (Supabase security advisor, 2026-10-22): the trigger function is never called directly, and
-- is_pro is only used inside the database, so nobody calls either over the API.
revoke execute on function public.guard_application_limits() from public, anon, authenticated;
revoke execute on function public.is_pro(uuid) from public, anon, authenticated;
