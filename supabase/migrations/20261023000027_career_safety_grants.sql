-- The audit hardening migration limits authenticated profile updates to an allowlist.
-- Career safety fields were added later, so authenticated users need explicit
-- column UPDATE grants for the profile save action to work.
-- Existing profiles_update RLS policy continues to enforce id = auth.uid().
grant update (deal_breakers, answer_library) on public.profiles to authenticated;
