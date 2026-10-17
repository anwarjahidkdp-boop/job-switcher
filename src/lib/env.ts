// Environment access. Secrets are read only on the server; NEXT_PUBLIC_* values are safe for the browser.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  inboundDomain: process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN || "jobs.example.com",
};

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const supabaseConfigured = () => !!(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
