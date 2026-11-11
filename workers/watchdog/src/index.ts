import { runWatchdog, type Env } from "./watchdog";

const worker = {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(runWatchdog(env));
  },
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
export default worker;
