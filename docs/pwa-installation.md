# Installation and account recovery

Reviewed 23 October 2026.

The old installer saved a permanent jp-install-hidden localStorage flag after acceptance or dismissal. Browser uninstall did not reset it. Android also depended on beforeinstallprompt firing, so no event meant no visible entry point.

The public /install page, footer link and Profile link are permanent. They never consult a prior install/dismissal flag. The floating reminder can only be dismissed for the current browser session. The single root installer captures browser prompts, consumes each once and falls back to native-browser menu instructions after an unavailable, rejected or dismissed prompt. A later prompt can be used after reinstall eligibility returns. Browser/OS heuristics still control native installation; the site does not claim to force a prompt.

Saved career data belongs to the authenticated account in Supabase (profiles, career_facts, cv_documents, master_cvs and applications). Installer events make no account API calls and do not reset onboarding, subscriptions, quotas or saved records. Clearing device/browser storage may sign a person out and lose unsaved edits; signing in to the same account reads the saved server records. Explicit account deletion is separate and is not reversed by reinstalling.

Tests cover no-prompt help, one-shot prompt consumption, a fresh later prompt, rejection/dismissal, OS guides and a public entry that ignores an old permanent dismissal flag.

Primary browser guidance:
- https://web.dev/learn/pwa/installation-prompt
- https://support.google.com/chrome/answer/9658361
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt
