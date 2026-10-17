-- Supabase security advisor fixes: pin search_path on trigger functions, and keep the auth trigger
-- function out of the public RPC API (triggers still run it).
alter function public.touch_updated_at() set search_path = public;
alter function public.guard_user_confirmed_status() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
