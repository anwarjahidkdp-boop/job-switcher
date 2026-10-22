# Auth protection configuration

The login, signup, email-code request and password-reset forms support Cloudflare Turnstile. Tokens are passed to Supabase Auth for server-side verification; expired/used tokens cannot be reused by the form. No CAPTCHA secret belongs in browser code.

Activation order:

1. Create a Turnstile widget restricted to `jobpao.app` (and explicitly approved staging hosts).
2. Set repository variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; deploy the widget before requiring CAPTCHA server-side.
3. Set the corresponding private Turnstile secret and enable Turnstile in Supabase Auth Bot and Abuse Protection.
4. Enable Supabase leaked-password protection if available on the project's plan. This is an Auth setting, not a SQL permission change.

The connected Supabase database tool does not expose Auth configuration, and the dashboard currently requires sign-in. Neither CAPTCHA enforcement nor leaked-password protection is claimed enabled without verifying the actual dashboard settings. Do not enable CAPTCHA before a working widget is deployed: doing so would block existing sign-ins.
