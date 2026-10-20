-- Gmail now confirms a forwarding address with a link instead of a typed code; keep the link for the setup guide.
alter table public.forwarding_addresses add column if not exists gmail_verification_link text;
